# Version v1.1.2 - Last modified: 2025-03-31
# Laundry Status Application - Multi-sensor support with improved dryer logic
from flask import Flask, render_template, jsonify, request, redirect, url_for, flash
from datetime import datetime, timedelta
import pytz
import os
import logging
from sqlalchemy import func, cast, extract, text
from models import db, SensorData, Sensor

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "laundry_room_sensor_key")

# Configure the database with Flask-SQLAlchemy
# Default to SQLite unless PostgreSQL is explicitly enabled
USE_POSTGRES = os.environ.get('USE_POSTGRES', 'False').lower() in ('true', '1', 'yes')
# For Mac version, use the specific path
MAC_VERSION = os.environ.get('MAC_VERSION', 'False').lower() in ('true', '1', 'yes')

if USE_POSTGRES and 'DATABASE_URL' in os.environ:
    # Use PostgreSQL database only if explicitly configured
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get('DATABASE_URL')
    app.logger.info("Using PostgreSQL database")
else:
    # Use SQLite database (default)
    if MAC_VERSION:
        sqlite_path = os.environ.get('SQLITE_PATH', '/Users/sergeiprutkin/Development/database/vib.db')
    else:
        sqlite_path = os.environ.get('SQLITE_PATH', '/Users/sergeiprutkin/Development/database/vib.db')
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{sqlite_path}"
    app.logger.info(f"Using SQLite database: {sqlite_path}")

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Initialize the app with the extension
db.init_app(app)

# Constants
WASHER_CYCLE = 37  # Default cycle time in minutes
DRYER_CYCLE = 64   # Updated dryer cycle to 64 minutes
REFRESH_INTERVAL = 5
GAP_THRESHOLD = 5
FILL_ADJUSTMENT = 6  # Adjustment for washer fill time (6 minutes)
MID_CYCLE_GAP_TOLERANCE = 8.25
DRYER_INACTIVE_TIMEOUT = 3  # Dryer is considered inactive after 3 minutes without vibration
TIMEZONE = pytz.timezone('America/Los_Angeles')

def get_sensor_status(sensor_type="washer"):
    """Get the current status of a specific sensor type."""
    
    # Query includes temperature data for the most recent 40 readings
    readings = SensorData.query.filter_by(sensor_name=sensor_type) \
                          .order_by(SensorData.vib_date.desc()) \
                          .limit(40).all()

    now = datetime.now(TIMEZONE)
    if not readings:
        free_since = now - timedelta(hours=1)
        return {
            'sensor_type': sensor_type,
            'status': 'free', 
            'free_since': free_since.strftime('%Y-%m-%d %H:%M:%S'), 
            'message': f'The {sensor_type} has been free for the last 60 minutes', 
            'voltage': None,
            'temperature': None
        }

    times = [TIMEZONE.localize(reading.vib_date.replace(tzinfo=None)) for reading in readings]
    latest_voltage = readings[0].voltage
    latest_temperature = readings[0].temp  # Get the latest temperature
    
    # Determine appropriate cycle time based on sensor type
    cycle_time = DRYER_CYCLE if sensor_type == 'dryer' else WASHER_CYCLE
    
    # Handle dryer and washer differently
    if sensor_type == 'dryer':
        # For dryers, we care about the time since the last reading
        time_since_last = (now - times[0]).total_seconds() / 60
        
        # If we haven't received data for DRYER_INACTIVE_TIMEOUT minutes, consider it free
        if time_since_last > DRYER_INACTIVE_TIMEOUT:
            free_minutes = int(time_since_last)
            return {
                'sensor_type': sensor_type,
                'status': 'free', 
                'free_since': times[0].strftime('%Y-%m-%d %H:%M:%S'), 
                'message': f'The {sensor_type} has been free for the last {free_minutes} minutes', 
                'voltage': float(latest_voltage) if latest_voltage is not None else None,
                'temperature': float(latest_temperature) if latest_temperature is not None else None
            }
        
        # Dryer logic - find when the current cycle started based on vibration
        cycle_start = times[0]
        for i in range(1, len(times)):
            current = times[i - 1]
            previous = times[i]
            gap = (current - previous).total_seconds() / 60
            if gap > MID_CYCLE_GAP_TOLERANCE:
                cycle_start = current
                break
        
        # No adjustment needed for dryer (starts vibrating immediately)
        time_since_start = (now - cycle_start).total_seconds() / 60
        
        # If within cycle time, dryer is busy
        if time_since_start <= cycle_time:
            minutes_running = int(time_since_start)
            minutes_remaining = max(0, cycle_time - minutes_running)
            return {
                'sensor_type': sensor_type,
                'status': 'busy', 
                'start_time': cycle_start.strftime('%Y-%m-%d %H:%M:%S'), 
                'minutes_remaining': minutes_remaining, 
                'message': f'The {sensor_type} is busy from {cycle_start.strftime("%I:%M %p")} for the last {minutes_running} minutes. Free in ~{minutes_remaining} minutes', 
                'voltage': float(latest_voltage) if latest_voltage is not None else None,
                'temperature': float(latest_temperature) if latest_temperature is not None else None
            }
        
        # Otherwise, dryer is free
        free_minutes = int(time_since_last)
        return {
            'sensor_type': sensor_type,
            'status': 'free', 
            'free_since': times[0].strftime('%Y-%m-%d %H:%M:%S'), 
            'message': f'The {sensor_type} has been free for the last {free_minutes} minutes', 
            'voltage': float(latest_voltage) if latest_voltage is not None else None,
            'temperature': float(latest_temperature) if latest_temperature is not None else None
        }
    
    else:
        # Original washer logic
        cycle_start = times[0]
        for i in range(1, len(times)):
            current = times[i - 1]
            previous = times[i]
            gap = (current - previous).total_seconds() / 60
            if gap > MID_CYCLE_GAP_TOLERANCE:
                cycle_start = current
                break

        adjusted_start = cycle_start - timedelta(minutes=FILL_ADJUSTMENT)
        time_since_start = (now - adjusted_start).total_seconds() / 60
        time_since_last = (now - times[0]).total_seconds() / 60

        if time_since_start <= cycle_time and time_since_last <= MID_CYCLE_GAP_TOLERANCE:
            minutes_running = int(time_since_start)
            minutes_remaining = max(0, cycle_time - minutes_running)
            return {
                'sensor_type': sensor_type,
                'status': 'busy', 
                'start_time': adjusted_start.strftime('%Y-%m-%d %H:%M:%S'), 
                'minutes_remaining': minutes_remaining, 
                'message': f'The {sensor_type} is busy from {adjusted_start.strftime("%I:%M %p")} for the last {minutes_running} minutes. Free in ~{minutes_remaining} minutes', 
                'voltage': float(latest_voltage) if latest_voltage is not None else None,
                'temperature': float(latest_temperature) if latest_temperature is not None else None
            }

        free_minutes = int(time_since_last)
        return {
            'sensor_type': sensor_type,
            'status': 'free', 
            'free_since': times[0].strftime('%Y-%m-%d %H:%M:%S'), 
            'message': f'The {sensor_type} has been free for the last {free_minutes} minutes', 
            'voltage': float(latest_voltage) if latest_voltage is not None else None,
            'temperature': float(latest_temperature) if latest_temperature is not None else None
        }

def get_all_sensors_status():
    """Get status for all known sensor types."""
    
    # Get all active sensor types
    sensors = Sensor.query.filter_by(status='active').all()
    
    # If no registered sensors, fall back to just washer
    if not sensors:
        return {'washer': get_sensor_status('washer')}
    
    # Get status for each sensor type
    status_dict = {}
    for sensor in sensors:
        sensor_type = sensor.sensor_type
        if sensor_type not in status_dict:
            status_dict[sensor_type] = get_sensor_status(sensor_type)
    
    return status_dict

def get_popular_times(sensor_type="washer", specified_day=None):
    """Get popular times data for a specific sensor type.
    
    Args:
        sensor_type: The type of sensor to get data for (default: "washer")
        specified_day: Optional day number (0-6 for Sun-Sat) to get data for
                      If None, uses the current day
    """
    now = datetime.now(TIMEZONE)
    current_day = now.weekday()  # 0 = Monday, 6 = Sunday in Python
    
    # Convert to 0 = Sunday, 6 = Saturday for UI consistency
    current_day = (current_day + 1) % 7
    
    # If specified_day is provided, use that instead
    day_index = specified_day if specified_day is not None else current_day
    
    # Get the day name
    days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    day_name = days[day_index]
    
    # Check if requested day is the current day
    is_current_day = day_index == current_day
    
    # Get current hour (0-23)
    current_hour = now.hour
    
    # Hours to display (7am to 10pm)
    display_hours = range(7, 22)
    
    # Convert to 12-hour format for display
    hour_labels = []
    hour_ranges = []
    for hr in display_hours:
        ampm = 'AM' if hr < 12 else 'PM'
        display_hr = hr if hr <= 12 else hr - 12
        if display_hr == 0:
            display_hr = 12
        hour_labels.append(f'{display_hr}:00')
        
        next_hr = (hr + 1) % 24
        next_ampm = 'AM' if next_hr < 12 else 'PM'
        next_display_hr = next_hr if next_hr <= 12 else next_hr - 12
        if next_display_hr == 0:
            next_display_hr = 12
        
        hour_ranges.append(f'{display_hr}–{next_display_hr}{ampm}')
    
    # Find the index of the current hour in our display range, if applicable
    current_hour_index = -1
    if is_current_day:
        for i, hr in enumerate(display_hours):
            if hr == current_hour:
                current_hour_index = i
                break
    
    # Get the status to determine if it's operating now
    status = get_sensor_status(sensor_type)
    is_operating = status['status'] == 'busy'
    current_time = now.strftime('%I:%M %p')
    
    # Determine if it's open based on the time of day
    # Assume laundry room is open 7am to 10pm
    is_open = 7 <= now.hour < 22 if is_current_day else False
    
    # Get the day of week from the database
    # Convert from Python's day numbering (0 = Monday) to 
    # SQLite's strftime %w (0 = Sunday)
    filter_day = day_index
    
    # Query to get distribution of usage by hour for the specified day
    sql_query = """
    SELECT 
        strftime('%H', vib_date) AS hour,
        COUNT(DISTINCT DATE(vib_date)) AS num_days,
        COUNT(*) AS num_readings
    FROM sensor_data
    WHERE 
        sensor_name = :sensor_type
        AND CAST(strftime('%w', vib_date) AS INTEGER) = :day_of_week
        AND strftime('%H', vib_date) BETWEEN '07' AND '21'
    GROUP BY hour
    ORDER BY hour
    """
    
    # For sqlite
    db_results = db.session.execute(text(sql_query), {
        'sensor_type': sensor_type,
        'day_of_week': filter_day
    }).fetchall()
    
    # Get total days in the dataset for this day of week
    total_days_query = """
    SELECT COUNT(DISTINCT DATE(vib_date)) 
    FROM sensor_data
    WHERE 
        sensor_name = :sensor_type
        AND CAST(strftime('%w', vib_date) AS INTEGER) = :day_of_week
    """
    
    total_days_result = db.session.execute(text(total_days_query), {
        'sensor_type': sensor_type,
        'day_of_week': filter_day
    }).scalar()
    
    total_days = total_days_result or 1  # Default to 1 to avoid division by zero
    
    # Process data for chart
    hours_data = {str(hr): 0 for hr in display_hours}
    categories = {str(hr): 'Not busy' for hr in display_hours}
    
    for row in db_results:
        hour_str = row[0]
        if hour_str.startswith('0'):
            hour_str = hour_str[1:]  # Remove leading zero
        
        hour = int(hour_str)
        if hour in display_hours:
            readings = row[2]
            days = row[1]
            
            # Calculate average readings per day for this hour
            avg_per_day = readings / days if days > 0 else 0
            
            # Calculate percentage of time busy during this hour
            # Assumption: 1 reading per minute while the washer is on
            # So 60 readings = 100% busy for the hour
            busy_pct = min(100, (avg_per_day / 60) * 100)
            hours_data[str(hour)] = round(busy_pct)
            
            # Categorize busyness
            if busy_pct < 25:
                categories[str(hour)] = 'Not busy'
            elif busy_pct < 50:
                categories[str(hour)] = 'Not too busy'
            elif busy_pct < 75:
                categories[str(hour)] = 'Fairly busy'
            else:
                categories[str(hour)] = 'Very busy'
    
    # Convert to ordered lists for chart.js
    data = [hours_data[str(hr)] for hr in display_hours]
    categories_list = [categories[str(hr)] for hr in display_hours]
    
    return {
        'sensor_type': sensor_type,
        'day': day_name,
        'day_index': day_index,
        'all_days': days,
        'hours': hour_labels,
        'hour_ranges': hour_ranges,
        'data': data,
        'categories': categories_list,
        'total_days': total_days,
        'current_hour_index': current_hour_index,
        'washer_status': status['status'],
        'is_open': is_open,
        'current_time': current_time,
        'is_current_day': is_current_day
    }

@app.route('/')
def index():
    """Render the main page with all sensor statuses."""
    sensor_statuses = get_all_sensors_status()
    popular_times = get_popular_times()
    
    #app.logger.debug(f"Popular Times for washer: {popular_times}")
    
    return render_template('index.html', 
                           sensors=sensor_statuses, 
                           popular_times=popular_times, 
                           version="1.1.2")

@app.route('/api/status')
def status_endpoint():
    """API endpoint to get current status of all sensors."""
    return jsonify(get_all_sensors_status())

@app.route('/api/status/<sensor_type>')
def sensor_status_endpoint(sensor_type):
    """API endpoint to get status for a specific sensor type."""
    return jsonify(get_sensor_status(sensor_type))

@app.route('/api/popular-times')
@app.route('/api/popular-times/<int:day>')
def popular_times_endpoint(day=None):
    """API endpoint to get popular times data for the washer.
    
    Args:
        day: Optional day number (0-6 for Sun-Sat). Default is current day.
    """
    sensor_type = request.args.get('sensor', 'washer')
    return jsonify(get_popular_times(sensor_type, day))

@app.route('/api/popular-times/week')
def popular_times_week_endpoint():
    """API endpoint to get popular times data for the entire week."""
    sensor_type = request.args.get('sensor', 'washer')
    
    # Get data for each day of the week
    week_data = {}
    for day in range(7):
        day_data = get_popular_times(sensor_type, day)
        week_data[day] = day_data
    
    return jsonify(week_data)

@app.route('/admin')
def admin_page():
    """Admin page for sensor management."""
    # Query for sensors with a count of their data
    sensors = db.session.query(
        Sensor, 
        func.count(SensorData.id).label('data_count')
    ).outerjoin(
        SensorData, 
        Sensor.sensor_type == SensorData.sensor_name
    ).group_by(
        Sensor.id
    ).order_by(
        Sensor.created_at.desc()
    ).all()
    
    # Get list of unique sensor types for dropdown
    sensor_types = db.session.query(Sensor.sensor_type).distinct().all()
    sensor_types = [t[0] for t in sensor_types]
    
    # Prepare sensor data for template
    sensor_data = []
    for sensor, data_count in sensors:
        sensor_data.append({
            'id': sensor.id,
            'mac_address': sensor.mac_address,
            'sensor_type': sensor.sensor_type,
            'name': sensor.name,
            'location': sensor.location,
            'created_at': sensor.created_at,
            'last_seen': sensor.last_seen,
            'last_time_sync': sensor.last_time_sync,
            'battery': sensor.battery,
            'status': sensor.status,
            'data_count': data_count
        })
    
    return render_template('admin.html', 
                          sensors=sensor_data, 
                          sensor_types=sensor_types,
                          version="1.1.2")

@app.route('/admin/update-sensor/<int:sensor_id>', methods=['POST'])
def update_sensor(sensor_id):
    """Update sensor information."""
    sensor = Sensor.query.get_or_404(sensor_id)
    
    if request.method == 'POST':
        sensor.name = request.form.get('name')
        sensor.location = request.form.get('location')
        sensor.sensor_type = request.form.get('sensor_type')
        sensor.status = request.form.get('status')
        
        db.session.commit()
        flash('Sensor updated successfully', 'success')
    
    return redirect(url_for('admin_page'))

@app.route('/admin/add-sensor-type', methods=['POST'])
def add_sensor_type():
    """Add a new sensor type."""
    if request.method == 'POST':
        mac_address = request.form.get('mac_address')
        sensor_type = request.form.get('sensor_type')
        name = request.form.get('name')
        location = request.form.get('location')
        
        # Check if MAC address already exists
        existing_sensor = Sensor.query.filter_by(mac_address=mac_address).first()
        if existing_sensor:
            flash('MAC address already exists', 'danger')
            return redirect(url_for('admin_page'))
        
        # Create new sensor
        new_sensor = Sensor(
            mac_address=mac_address,
            sensor_type=sensor_type,
            name=name,
            location=location,
            status='active'
        )
        
        db.session.add(new_sensor)
        db.session.commit()
        flash('New sensor added successfully', 'success')
    
    return redirect(url_for('admin_page'))

@app.route('/admin/delete-sensor/<int:sensor_id>', methods=['POST'])
def delete_sensor(sensor_id):
    """Delete a sensor that is marked as inactive."""
    sensor = Sensor.query.get_or_404(sensor_id)
    
    # Only allow deletion if the sensor is inactive
    if sensor.status != 'inactive':
        flash('Only inactive sensors can be deleted', 'danger')
        return redirect(url_for('admin_page'))
    
    # Delete the sensor
    db.session.delete(sensor)
    db.session.commit()
    flash('Sensor deleted successfully', 'success')
    
    return redirect(url_for('admin_page'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)