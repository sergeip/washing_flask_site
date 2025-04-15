// script.js v1.2.0

let lastDay = null;
let lastHour = null;
let lastWasherStatus = null;
let chart = null;

/**
 * Updates the operating status display based on the current time
 * @param {string} currentTime - Optional time string to display
 */
function updateOperatingStatus(currentTime) {
    const now = new Date();
    const currentHour = now.getHours();
    const operatingText = document.getElementById('operating-text');
    const localTimeText = document.getElementById('local-time');
    
    if (currentHour >= 7 && currentHour < 22) {
        operatingText.textContent = 'Laundry Room: OPEN until 22:00';
        operatingText.className = 'open';
    } else {
        operatingText.textContent = 'Laundry Room: CLOSED until 7:00 AM';
        operatingText.className = 'closed';
    }
    
    localTimeText.textContent = currentTime || now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    });
    console.log('Current Time Set To:', localTimeText.textContent);
}

/**
 * Updates the battery status display based on voltage
 * @param {number} voltage - Battery voltage
 * @param {string} sensorType - Type of sensor ('washer' or 'dryer')
 */
function updateBatteryStatus(voltage, sensorType = 'washer') {
    const battery = document.getElementById(`${sensorType}-battery`);
    const voltageDisplay = document.getElementById(`${sensorType}-voltage`);
    
    if (!battery || !voltageDisplay) return;
    
    console.log('Battery Voltage:', voltage);
    
    if (voltage === null || voltage === undefined || voltage < 2.9) {
        battery.className = 'battery battery-0';
        voltageDisplay.textContent = voltage !== null && voltage !== undefined ? `${voltage.toFixed(2)}V` : 'N/A';
        console.log('Battery set to 0 bars');
    } else if (voltage <= 3.2) {
        battery.className = 'battery battery-1';
        voltageDisplay.textContent = `${voltage.toFixed(2)}V`;
        console.log('Battery set to 1 bar');
    } else if (voltage <= 3.4) {
        battery.className = 'battery battery-2';
        voltageDisplay.textContent = `${voltage.toFixed(2)}V`;
        console.log('Battery set to 2 bars');
    } else if (voltage <= 3.6) {
        battery.className = 'battery battery-3';
        voltageDisplay.textContent = `${voltage.toFixed(2)}V`;
        console.log('Battery set to 3 bars');
    } else {
        battery.className = 'battery battery-4';
        voltageDisplay.textContent = `${voltage.toFixed(2)}V`;
        console.log('Battery set to 4 bars');
    }
}

/**
 * Updates the temperature display
 * @param {number} temperature - Temperature in degrees
 * @param {string} sensorType - Type of sensor ('washer' or 'dryer')
 */
function updateTemperatureDisplay(temperature, sensorType = 'washer') {
    const tempDisplay = document.getElementById(`${sensorType}-temperature`);
    
    if (!tempDisplay) return;
    
    if (temperature === null || temperature === undefined) {
        tempDisplay.textContent = 'N/A';
    } else {
        tempDisplay.textContent = `${temperature.toFixed(1)}°C`;
    }
    
    console.log('Temperature set to:', tempDisplay.textContent);
}

/**
 * Gets the busyness category based on percentage or uses provided category
 * @param {number} percentage - Busyness percentage
 * @param {string} category - Optional category provided by server
 * @return {string} - Busyness category description
 */
function getBusynessCategory(percentage, category) {
    if (category) return category;
    
    if (percentage >= 75) return 'Usually busy';
    if (percentage >= 50) return 'Usually a little busy';
    if (percentage >= 25) return 'Usually not too busy';
    return 'Usually not busy';
}

/**
 * Initializes the status display with the provided data
 * @param {Object} washerStatus - Washer status data
 * @param {Object} dryerStatus - Dryer status data
 */
function initializeStatus(washerStatus, dryerStatus) {
    // Update washer status
    const washerStatusElement = document.getElementById('washer-status');
    washerStatusElement.textContent = washerStatus.message;
    washerStatusElement.className = washerStatus.status;
    
    // Update dryer status
    const dryerStatusElement = document.getElementById('dryer-status');
    dryerStatusElement.textContent = dryerStatus.message;
    dryerStatusElement.className = dryerStatus.status;
    
    // Update washer battery and temperature
    updateBatteryStatus(washerStatus.voltage, 'washer');
    updateTemperatureDisplay(washerStatus.temperature, 'washer');
    
    // Update dryer battery and temperature if available
    if (dryerStatus.voltage !== undefined) {
        updateBatteryStatus(dryerStatus.voltage, 'dryer');
    }
    if (dryerStatus.temperature !== undefined) {
        updateTemperatureDisplay(dryerStatus.temperature, 'dryer');
    }
    
    // Update operating status
    updateOperatingStatus();
    
    // Get popular times data
    updatePopularTimes();
}

/**
 * Updates the status by fetching new data from the server
 */
function refreshStatus() {
    fetch('/api/status')
        .then(response => {
            if (!response.ok) throw new Error('Status fetch failed: ' + response.status);
            return response.json();
        })
        .then(data => {
            // Update washer status
            const washerStatusElement = document.getElementById('washer-status');
            washerStatusElement.textContent = data.washer.message;
            washerStatusElement.className = data.washer.status;
            
            // Update dryer status
            const dryerStatusElement = document.getElementById('dryer-status');
            dryerStatusElement.textContent = data.dryer.message;
            dryerStatusElement.className = data.dryer.status;
            
            // Update washer battery and temperature
            updateBatteryStatus(data.washer.voltage, 'washer');
            updateTemperatureDisplay(data.washer.temperature, 'washer');
            
            // Update dryer battery and temperature if available
            if (data.dryer.voltage !== undefined) {
                updateBatteryStatus(data.dryer.voltage, 'dryer');
            }
            if (data.dryer.temperature !== undefined) {
                updateTemperatureDisplay(data.dryer.temperature, 'dryer');
            }
            
            // Update operating status
            updateOperatingStatus();
            
            // Update popular times only if there's a change
            const now = new Date();
            const currentDay = now.getDay();
            const currentHour = now.getHours();
            
            if (lastDay !== currentDay || lastHour !== currentHour || lastWasherStatus !== data.washer.status) {
                updatePopularTimes();
            }
        })
        .catch(error => {
            console.error('Error refreshing status:', error);
        });
}

/**
 * Updates the popular times chart
 */
let currentDayIndex = null;

/**
 * Updates the popular times widget for the specified day or current day
 * @param {number} dayIndex - Optional day index (0-6 for Sun-Sat)
 */
function updatePopularTimes(dayIndex) {
    // Update the last interaction time
    lastInteractionTime = Date.now();
    
    const endpoint = (dayIndex !== undefined && dayIndex >= 0 && dayIndex <= 6) 
        ? `/api/popular-times/${dayIndex}` 
        : '/api/popular-times';
    
    fetch(endpoint)
        .then(response => {
            if (!response.ok) throw new Error('Popular times fetch failed: ' + response.status);
            return response.json();
        })
        .then(popularTimes => {
            console.log('Popular Times Data:', popularTimes);
            
            // Ensure all_days is properly defined as an array
            if (!popularTimes.all_days || typeof popularTimes.all_days.forEach !== 'function') {
                console.log('Adding default days array to popularTimes');
                popularTimes.all_days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            }
            
            // Store the current day index for potential reuse
            currentDayIndex = popularTimes.day_index;
            
            // Create the day selector if it doesn't exist yet
            createDaySelector(popularTimes);
            
            // Update the day indicator dots
            updateDayIndicatorDots(popularTimes);
            
            // Update the heading with day selector
            updatePopularTimesHeading(popularTimes);
            
            // Update global trackers
            lastDay = new Date().getDay();
            lastHour = new Date().getHours();
            lastWasherStatus = popularTimes.washer_status;

            const customLabels = popularTimes.hours.map((label, index) => {
                if (index === 0 || index === 3 || index === 6 || index === 9 || index === 12) {
                    // Add AM/PM indicator to the hour label
                    const hourPart = label.split('–')[0];
                    const hourNum = parseInt(hourPart);
                    const amPm = (hourNum >= 7 && hourNum < 12) || hourNum === 0 ? 'AM' : 'PM';
                    return hourPart + amPm;
                } else {
                    return '';
                }
            });
            
            const chartWidth = document.getElementById('popularTimesChart').parentElement.clientWidth;
            const barWidth = (chartWidth - 10) / 15; // Slight padding to fit snugly

            const data = popularTimes.data.slice();
            const backgroundColors = popularTimes.data.map(percentage => {
                if (percentage >= 75) return 'rgba(255, 0, 0, 0.7)';
                if (percentage >= 50) return 'rgba(255, 165, 0, 0.7)';
                if (percentage >= 25) return 'rgba(255, 255, 0, 0.7)';
                return 'rgba(150, 150, 150, 0.7)';
            });

            // Only add real-time indicator if showing current day
            if (popularTimes.is_current_day && popularTimes.is_open && popularTimes.current_hour_index >= 0) {
                data[popularTimes.current_hour_index] = Math.max(data[popularTimes.current_hour_index], 20);
                backgroundColors[popularTimes.current_hour_index] = popularTimes.washer_status === 'free'
                    ? 'rgba(0, 128, 0, 0.7)'
                    : 'rgba(255, 0, 0, 0.7)';
            }

            const datasets = [{
                label: 'Popular Times',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: 'rgba(100, 100, 100, 1)',
                borderWidth: 1,
                barThickness: barWidth,
            }];

            if (chart) chart.destroy();
            
            const ctx = document.getElementById('popularTimesChart').getContext('2d');
            chart = new Chart(ctx, {
                type: 'bar',
                data: { labels: customLabels, datasets: datasets },
                options: {
                    indexAxis: 'x',
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            max: 100, 
                            ticks: { display: false }, 
                            grid: { display: false }, 
                            title: { display: true, text: popularTimes.day } 
                        },
                        x: { 
                            grid: { display: false }, 
                            title: { display: true, text: 'Time of Day' }, 
                            ticks: { align: 'center' } 
                        }
                    },
                    plugins: { 
                        legend: { display: false }, 
                        tooltip: { enabled: true }
                    },
                    maintainAspectRatio: false,
                    animation: { duration: 400 },
                    layout: { padding: { left: 5, right: 5 } },
                    elements: { bar: { borderSkipped: false, borderRadius: 2 } }
                }
            });

            setupCustomTooltips(popularTimes);
        })
        .catch(error => {
            console.error('Error updating popular times:', error);
            // Create a default popular times data structure if there's an error
            const defaultPopularTimes = {
                all_days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                day_index: new Date().getDay(),
                data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                hour_ranges: ['7–8', '8–9', '9–10', '10–11', '11–12', '12–1', '1–2', '2–3', '3–4', '4–5', '5–6', '6–7', '7–8', '8–9', '9–10'],
                hours: ['7:00', '8:00', '9:00', '10:00', '11:00', '12:00', '1:00', '2:00', '3:00', '4:00', '5:00', '6:00', '7:00', '8:00', '9:00'],
                is_current_day: true,
                current_hour_index: new Date().getHours() - 7,
                washer_status: 'unknown',
                is_open: true
            };
            
            // Try to render with default data
            try {
                createDaySelector(defaultPopularTimes);
                updateDayIndicatorDots(defaultPopularTimes);
                updatePopularTimesHeading(defaultPopularTimes);
                
                // Show error message in chart area
                const chartContainer = document.getElementById('day-view');
                if (chartContainer) {
                    const errorMessage = document.createElement('div');
                    errorMessage.className = 'error-message';
                    errorMessage.textContent = 'Unable to load popular times data. Please try again later.';
                    chartContainer.appendChild(errorMessage);
                }
            } catch (e) {
                console.error('Failed to show error state:', e);
            }
        });
}

/**
 * Creates or updates the day selector with dropdown
 * @param {Object} popularTimes - Popular times data
 */
function createDaySelector(popularTimes) {
    // Only create once
    if (document.querySelector('.day-selector')) return;
    
    const heading = document.getElementById('popular-times-heading');
    
    // Create day selector container
    const daySelector = document.createElement('div');
    daySelector.className = 'day-selector';
    
    // Create toggle element
    const toggle = document.createElement('div');
    toggle.className = 'day-selector-toggle';
    toggle.innerHTML = `<span id="day-selector-current">${popularTimes.day}</span><span class="day-selector-icon"></span>`;
    
    // Create dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'day-selector-dropdown';
    
    // Add days to dropdown
    // Make sure all_days is an array before using forEach
    const allDays = Array.isArray(popularTimes.all_days) ? popularTimes.all_days : 
                   ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    allDays.forEach((day, index) => {
        const item = document.createElement('div');
        item.className = `day-selector-item ${index === popularTimes.day_index ? 'active' : ''}`;
        item.textContent = day;
        item.dataset.dayIndex = index;
        item.addEventListener('click', (e) => {
            updatePopularTimes(parseInt(e.target.dataset.dayIndex));
            dropdown.classList.remove('show');
        });
        dropdown.appendChild(item);
    });
    
    // Toggle dropdown on click
    toggle.addEventListener('click', () => {
        dropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!daySelector.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
    
    // Assemble the components
    daySelector.appendChild(toggle);
    daySelector.appendChild(dropdown);
    
    // Add to heading
    heading.textContent = 'Popular Times: ';
    heading.appendChild(daySelector);
}

/**
 * Updates the dots indicating each day of the week
 * @param {Object} popularTimes - Popular times data
 */
function updateDayIndicatorDots(popularTimes) {
    const dotsContainer = document.getElementById('day-indicator-dots');
    dotsContainer.innerHTML = '';
    
    // Create a dot for each day of the week, ensuring all_days is an array
    const allDays = Array.isArray(popularTimes.all_days) ? popularTimes.all_days : 
                   ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                   
    allDays.forEach((day, index) => {
        const dot = document.createElement('span');
        dot.className = `day-dot ${index === popularTimes.day_index ? 'active' : ''}`;
        dot.title = day;
        dot.dataset.dayIndex = index;
        
        // Add click event to switch day
        dot.addEventListener('click', (e) => {
            updatePopularTimes(parseInt(e.target.dataset.dayIndex));
        });
        
        dotsContainer.appendChild(dot);
    });
}

/**
 * Updates just the heading text, preserving the day selector dropdown
 * @param {Object} popularTimes - Popular times data
 */
function updatePopularTimesHeading(popularTimes) {
    // Update the day in the toggle without recreating the whole selector
    const currentDayElement = document.getElementById('day-selector-current');
    if (currentDayElement) {
        currentDayElement.textContent = popularTimes.day;
    }
    
    // Update active states in dropdown
    const dropdownItems = document.querySelectorAll('.day-selector-item');
    dropdownItems.forEach(item => {
        if (parseInt(item.dataset.dayIndex) === popularTimes.day_index) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

/**
 * Sets up custom tooltips for the chart
 * @param {Object} popularTimes - Popular times data
 */
function setupCustomTooltips(popularTimes) {
    const canvas = document.getElementById('popularTimesChart');
    
    // Remove existing tooltip if present
    let existingTooltip = document.getElementById('custom-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
    
    // Create tooltip element
    const tooltipEl = document.createElement('div');
    tooltipEl.id = 'custom-tooltip';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltipEl.style.color = '#fff';
    tooltipEl.style.padding = '5px 8px';
    tooltipEl.style.borderRadius = '4px';
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.fontSize = '12px';
    tooltipEl.style.opacity = '0';
    tooltipEl.style.transition = 'opacity 0.3s';
    tooltipEl.style.zIndex = '1000';
    document.body.appendChild(tooltipEl);
    
    // Add event listeners
    canvas.onmousemove = (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const chartArea = chart.chartArea;
        
        // Check if mouse is within chart area
        if (x >= chartArea.left && x <= chartArea.right) {
            const barWidth = (chartArea.right - chartArea.left) / 15;
            const index = Math.floor((x - chartArea.left) / barWidth);
            
            if (index >= 0 && index < 15) {
                const value = chart.data.datasets[0].data[index];
                let hourRange = popularTimes.hour_ranges[index];
                const isNow = index === popularTimes.current_hour_index && popularTimes.is_open;
                
                // Add AM/PM to hour range
                const times = hourRange.split('–');
                if (times.length === 2) {
                    const startHour = parseInt(times[0]);
                    const endHour = parseInt(times[1]);
                    const startAmPm = (startHour >= 7 && startHour < 12) || startHour === 0 ? 'AM' : 'PM';
                    const endAmPm = (endHour >= 7 && endHour < 12) || endHour === 0 ? 'AM' : 'PM';
                    hourRange = `${times[0]}${startAmPm} – ${times[1]}${endAmPm}`;
                }
                
                // Use server-provided category if available
                const category = popularTimes.categories ? popularTimes.categories[index] : null;
                const busynessText = getBusynessCategory(value, category);
                
                // Show real-time status if this is the current hour
                const nowText = isNow ? ` • NOW (${popularTimes.washer_status === 'free' ? 'Free' : 'Busy'})` : '';
                
                tooltipEl.innerHTML = `
                    <div>${hourRange}${nowText}</div>
                    <div>${busynessText} (${value}%)</div>
                `;
                
                tooltipEl.style.left = `${event.clientX}px`;
                tooltipEl.style.top = `${event.clientY - 40}px`;
                tooltipEl.style.opacity = '1';
            }
        } else {
            tooltipEl.style.opacity = '0';
        }
    };
    
    canvas.onmouseleave = () => {
        tooltipEl.style.opacity = '0';
    };
}

/**
 * Sets up tooltips for the Week View grid cells
 */
function setupWeekViewTooltips() {
    // Remove existing week tooltip if present
    let existingWeekTooltip = document.getElementById('week-tooltip');
    if (existingWeekTooltip) {
        existingWeekTooltip.remove();
    }
    
    // Create tooltip element using the same style as day view tooltips
    const tooltipEl = document.createElement('div');
    tooltipEl.id = 'week-tooltip';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltipEl.style.color = '#fff';
    tooltipEl.style.padding = '5px 8px';
    tooltipEl.style.borderRadius = '4px';
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.fontSize = '12px';
    tooltipEl.style.opacity = '0';
    tooltipEl.style.transition = 'opacity 0.3s';
    tooltipEl.style.zIndex = '1000';
    document.body.appendChild(tooltipEl);
    
    // Add event delegation to the week grid
    const weekGrid = document.getElementById('week-grid');
    
    weekGrid.addEventListener('mouseover', (event) => {
        // Check if we're hovering over a week cell
        if (event.target.classList.contains('week-cell')) {
            const cell = event.target;
            const value = cell.dataset.value;
            let hourRange = cell.dataset.hourRange;
            const day = cell.dataset.day;
            const isCurrent = cell.dataset.isCurrent === 'true';
            const isToday = cell.dataset.isToday === 'true';
            
            // Add AM/PM to hour range
            const times = hourRange.split('–');
            if (times.length === 2) {
                const startHour = parseInt(times[0]);
                const endHour = parseInt(times[1]);
                const startAmPm = (startHour >= 7 && startHour < 12) || startHour === 0 ? 'AM' : 'PM';
                const endAmPm = (endHour >= 7 && endHour < 12) || endHour === 0 ? 'AM' : 'PM';
                hourRange = `${times[0]}${startAmPm} – ${times[1]}${endAmPm}`;
            }
            
            // Determine busyness category from the cell's class
            let busynessText = 'Not busy';
            if (cell.classList.contains('busy')) {
                busynessText = 'Usually busy';
            } else if (cell.classList.contains('little-busy')) {
                busynessText = 'Usually a little busy';
            } else if (cell.classList.contains('not-too-busy')) {
                busynessText = 'Usually not too busy';
            }
            
            // Show "NOW" indicator if this is the current time slot on the current day
            const nowText = isCurrent ? ' • NOW' : '';
            const todayText = isToday ? ' (Today)' : '';
            
            tooltipEl.innerHTML = `
                <div>${day}${todayText}, ${hourRange}${nowText}</div>
                <div>${busynessText} (${value}%)</div>
            `;
            
            tooltipEl.style.left = `${event.clientX}px`;
            tooltipEl.style.top = `${event.clientY - 40}px`;
            tooltipEl.style.opacity = '1';
        }
    });
    
    weekGrid.addEventListener('mousemove', (event) => {
        if (event.target.classList.contains('week-cell')) {
            tooltipEl.style.left = `${event.clientX}px`;
            tooltipEl.style.top = `${event.clientY - 40}px`;
        }
    });
    
    weekGrid.addEventListener('mouseleave', () => {
        tooltipEl.style.opacity = '0';
    });
    
    // Hide tooltip when mouse leaves a cell
    weekGrid.addEventListener('mouseout', (event) => {
        if (event.target.classList.contains('week-cell') && 
            !event.relatedTarget.classList.contains('week-cell')) {
            tooltipEl.style.opacity = '0';
        }
    });
}

/**
 * Fetch and render the week view with data for all days
 */
function loadWeekView() {
    // Show loading state
    const weekGrid = document.getElementById('week-grid');
    weekGrid.innerHTML = '<div class="loading">Loading week data...</div>';
    
    // Fetch data for all days of the week
    fetch('/api/popular-times/week')
        .then(response => response.json())
        .then(weekData => {
            console.log("Popular Times Week Data:", weekData);
            
            // Create the week grid
            renderWeekGrid(weekData);
        })
        .catch(error => {
            console.error('Error fetching week data:', error);
            
            // Create empty week data with default structure
            try {
                const defaultWeekData = {};
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                
                for (let i = 0; i < 7; i++) {
                    defaultWeekData[i] = {
                        day: dayNames[i],
                        day_index: i,
                        all_days: dayNames,
                        hour_ranges: ['7–8', '8–9', '9–10', '10–11', '11–12', '12–1', '1–2', '2–3', '3–4', '4–5', '5–6', '6–7', '7–8', '8–9', '9–10'],
                        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                    };
                }
                
                // Try to render with default data
                renderWeekGrid(defaultWeekData);
                
                // Add error message in grid
                const errorMessage = document.createElement('div');
                errorMessage.className = 'week-error-message';
                errorMessage.textContent = 'Unable to load week data. Showing empty grid.';
                errorMessage.style.gridColumn = '1 / span 16';
                errorMessage.style.textAlign = 'center';
                errorMessage.style.color = 'red';
                errorMessage.style.padding = '10px';
                weekGrid.appendChild(errorMessage);
                
            } catch (e) {
                console.error('Failed to create default week view:', e);
                weekGrid.innerHTML = '<div class="error">Failed to load week data</div>';
            }
        });
}

/**
 * Create the week grid visualization
 * @param {Object} weekData - Data for all days of the week
 */
function renderWeekGrid(weekData) {
    const weekGrid = document.getElementById('week-grid');
    weekGrid.innerHTML = '';
    
    // Get all hour ranges - same for all days
    const hours = weekData[0].hour_ranges;
    
    // Ensure all_days is an array
    const days = Array.isArray(weekData[0].all_days) ? weekData[0].all_days : 
                ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Add the hour labels row at the top
    const hourLabelRow = document.createElement('div');
    hourLabelRow.className = 'hour-label';
    hourLabelRow.style.gridColumn = '2 / span 15';
    
    // Add blank space for the day labels column
    const blankCell = document.createElement('div');
    blankCell.style.gridColumn = '1';
    weekGrid.appendChild(blankCell);
    
    // Add hour labels with AM/PM
    hours.forEach((hour, i) => {
        const hourTick = document.createElement('div');
        hourTick.className = 'hour-tick';
        // Only show every 3rd hour for readability, include AM/PM
        if (i % 3=== 0) {
            const hourPart = hour.split('–')[0];
            // Add AM/PM based on the hour
            const hourNum = parseInt(hourPart);
            const amPm = (hourNum >= 7 && hourNum < 12) || hourNum === 0 ? 'AM' : 'PM';
            hourTick.textContent = hourPart + amPm;
        } else {
            hourTick.textContent = '';
        }
        hourLabelRow.appendChild(hourTick);
    });
    weekGrid.appendChild(hourLabelRow);
    
    // Setup tooltip for Week View
    setupWeekViewTooltips();
    
    // Get the current day and hour for highlighting
    const now = new Date();
    const currentDay = now.getDay(); // 0-6, Sun-Sat
    const currentHour = now.getHours();
    const currentHourIndex = currentHour - 7; // 7AM = index 0
    
    // Add each day's data
    Object.keys(weekData).forEach(dayIndex => {
        const dayData = weekData[dayIndex];
        const isToday = parseInt(dayIndex) === currentDay;
        
        // Add day label in the first column
        const dayLabel = document.createElement('div');
        dayLabel.className = 'day-label';
        dayLabel.textContent = days[dayIndex];
        if (isToday) {
            dayLabel.style.fontWeight = 'bold';
            dayLabel.style.color = '#4a90e2';
        }
        weekGrid.appendChild(dayLabel);
        
        // Add cells for each hour of the day
        dayData.data.forEach((value, hourIndex) => {
            const cell = document.createElement('div');
            cell.className = 'week-cell';
            
            // Get the busyness category
            let category;
            if (value >= 75) {
                category = 'busy';
            } else if (value >= 50) {
                category = 'little-busy';
            } else if (value >= 25) {
                category = 'not-too-busy';
            } else {
                category = 'not-busy';
            }
            
            cell.classList.add(category);
            
            // Store data for tooltips
            cell.dataset.value = value;
            cell.dataset.hourRange = hours[hourIndex];
            cell.dataset.day = days[dayIndex];
            cell.dataset.hourIndex = hourIndex;
            cell.dataset.dayIndex = dayIndex;
            cell.dataset.category = category;
            cell.dataset.isToday = isToday;
            
            // Add visual indicator if this is the current hour on the current day
            if (isToday && hourIndex === currentHourIndex && 0 <= currentHourIndex && currentHourIndex < 15) {
                cell.classList.add('current');
                cell.dataset.isCurrent = 'true';
                cell.textContent = value + '%';
            } else {
                // Show percentage on hover
                cell.textContent = value + '%';
            }
            
            // Add click handler to show detailed day view
            cell.addEventListener('click', () => {
                // Switch to day view and show this specific day
                switchToView('day');
                updatePopularTimes(parseInt(dayIndex));
            });
            
            weekGrid.appendChild(cell);
        });
    });
}

/**
 * Switch between day and week views
 * @param {string} viewName - Either 'day' or 'week'
 */
function switchToView(viewName) {
    const dayView = document.getElementById('day-view');
    const weekView = document.getElementById('week-view');
    const dayViewBtn = document.getElementById('day-view-btn');
    const weekViewBtn = document.getElementById('week-view-btn');
    const todayBtnContainer = document.getElementById('today-btn-container');
    
    if (viewName === 'day') {
        dayView.style.display = 'block';
        weekView.style.display = 'none';
        dayViewBtn.classList.add('active');
        weekViewBtn.classList.remove('active');
        todayBtnContainer.style.display = 'none'; // Hide Today button in day view
    } else {
        dayView.style.display = 'none';
        weekView.style.display = 'block';
        dayViewBtn.classList.remove('active');
        weekViewBtn.classList.add('active');
        todayBtnContainer.style.display = 'flex'; // Show Today button in week view
        
        // Load week data if it's not already loaded
        if (document.getElementById('week-grid').children.length <= 1) {
            loadWeekView();
        }
    }
}

/**
 * Reset to today's view
 */
function resetToToday() {
    // Switch to day view if needed
    switchToView('day');
    
    // Get current day of week (0-6, Sun-Sat)
    const now = new Date();
    const today = now.getDay();
    
    // Update to today's data
    updatePopularTimes(today);
}

// Store last interaction time
let lastInteractionTime = Date.now();

// Set auto-reset timer
function checkAutoReset() {
    const resetThreshold = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();
    
    if (now - lastInteractionTime > resetThreshold) {
        resetToToday();
        lastInteractionTime = now; // Reset the timer
    }
}

// Run auto-reset check every minute
setInterval(checkAutoReset, 60 * 1000);

// Initialize the operating status on page load
document.addEventListener('DOMContentLoaded', function() {
    updateOperatingStatus();
    
    // Setup view toggle buttons
    document.getElementById('day-view-btn').addEventListener('click', () => {
        switchToView('day');
        lastInteractionTime = Date.now();
    });
    
    document.getElementById('week-view-btn').addEventListener('click', () => {
        switchToView('week');
        lastInteractionTime = Date.now();
    });
    
    // Setup today button
    document.getElementById('today-btn').addEventListener('click', () => {
        resetToToday();
        lastInteractionTime = Date.now();
    });
});