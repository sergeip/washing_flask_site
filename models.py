# Version v1.1.1 - Last modified: 2025-03-31
# Database models for Laundry Status Application
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Create SQLAlchemy instance
db = SQLAlchemy()

class SensorData(db.Model):
    """Model for sensor readings data."""
    __tablename__ = 'sensor_data'
    
    id = db.Column(db.Integer, primary_key=True)
    sensor_name = db.Column(db.String(50), nullable=False)
    vib_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    temp = db.Column(db.Float, nullable=True)
    vibration = db.Column(db.Float, nullable=True)
    boot = db.Column(db.Integer, nullable=True)
    voltage = db.Column(db.Float, nullable=True)
    rssi = db.Column(db.Integer, nullable=True)
    
    def __repr__(self):
        return f'<SensorData {self.id} {self.sensor_name} {self.vib_date}>'

class Sensor(db.Model):
    """Model for registered sensors."""
    __tablename__ = 'sensors'
    
    id = db.Column(db.Integer, primary_key=True)
    mac_address = db.Column(db.String(20), unique=True, nullable=False)
    sensor_type = db.Column(db.String(50), nullable=False, default='unknown')
    name = db.Column(db.String(100), nullable=True)
    location = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, nullable=True)
    last_time_sync = db.Column(db.DateTime, nullable=True)
    battery = db.Column(db.Float, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='active')
    
    def __repr__(self):
        return f'<Sensor {self.id} {self.mac_address} {self.sensor_type}>'