// Global variables
let rawData = [];
let filteredData = [];
let selectedGenre = null;
let isAnimating = false;

// Global color scale for genres - will be initialized dynamically
let colorScale;

// Default color palette for genres
const genreColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5', '#ff9896', '#c5b0d5'];

/**
 * Initialize or update the global color scale based on genre list
 */
function initializeColorScale(genres) {
    // Sort genres for consistent color assignment
    const sortedGenres = Array.from(genres).sort();
    colorScale = d3.scaleOrdinal()
        .domain(sortedGenres)
        .range(genreColors.slice(0, sortedGenres.length));
    
    // If we need more colors, extend the palette
    if (sortedGenres.length > genreColors.length) {
        const extendedColors = [...genreColors];
        for (let i = genreColors.length; i < sortedGenres.length; i++) {
            // Generate additional colors using d3 color schemes
            extendedColors.push(d3.schemeCategory20[i % 20] || d3.interpolateRainbow(i / sortedGenres.length));
        }
        colorScale.range(extendedColors.slice(0, sortedGenres.length));
    }
}

/**
 * Parse genres string from CSV format: "[{'id': 18, 'name': 'Drama'}, {'id': 10749, 'name': 'Romance'}]"
 * Returns an array of genre names only
 */
function parseGenres(genresString) {
    if (!genresString || genresString === 'Unknown' || genresString === '[]') {
        return [];
    }
    
    // Handle empty list
    if (genresString.trim() === '[]') {
        return [];
    }
    
    // Use regex to extract genre names from the pattern: 'name': 'GenreName'
    // This handles the Python dictionary string format reliably
    const nameMatches = genresString.match(/'name':\s*'([^']+)'/g);
    if (nameMatches) {
        return nameMatches.map(match => {
            // Extract the genre name from the match
            const nameMatch = match.match(/'name':\s*'([^']+)'/);
            return nameMatch ? nameMatch[1] : null;
        }).filter(name => name !== null);
    }
    
    // Fallback: try JSON parsing if format is different
    try {
        // Replace single quotes with double quotes to make it valid JSON
        let jsonString = genresString.replace(/'/g, '"');
        const genresArray = JSON.parse(jsonString);
        
        // Extract only the 'name' field from each genre object
        return genresArray
            .filter(genre => genre && genre.name)
            .map(genre => genre.name);
    } catch (e) {
        console.warn('Failed to parse genres:', genresString);
        return [];
    }
}

function processData(data) {
    console.log('Processing', data.length, 'rows');
    
    // Clean and process data
    rawData = data.filter(d => {
        const budget = parseFloat(d.budget);
        const revenue = parseFloat(d.revenue);
        const runtime = parseFloat(d.runtime);
        return !isNaN(budget) && !isNaN(revenue) && !isNaN(runtime) && 
               budget > 0 && revenue > 0 && runtime > 0;
    }).map(d => {
        const genreList = parseGenres(d.genres || 'Unknown');
        return {
            id: d.id,
            title: d.title || 'Unknown',
            budget: parseFloat(d.budget),
            revenue: parseFloat(d.revenue),
            runtime: parseFloat(d.runtime),
            genres: d.genres || 'Unknown',
            genreList: genreList,
            language: d.original_language || 'Unknown',
            roi: ((parseFloat(d.revenue) - parseFloat(d.budget)) / parseFloat(d.budget)) * 100,
            profit: parseFloat(d.revenue) - parseFloat(d.budget),
            mainGenre: getMainGenre(genreList)
        };
    });

    console.log('Filtered to', rawData.length, 'valid movies');

    if (rawData.length === 0) {
        console.error('No valid data found in CSV');
        return;
    }

    // Extract unique genres and languages
    const genreSet = new Set();
    const languageSet = new Set();
    
    rawData.forEach(d => {
        d.genreList.forEach(g => {
            if (g && g !== 'Unknown') genreSet.add(g);
        });
        if (d.language && d.language !== 'Unknown') languageSet.add(d.language);
    });

    // Initialize global color scale with all genres
    initializeColorScale(genreSet);

    // Populate genre filter with color indicators
    const genreFilter = document.getElementById('genreFilter');
    genreFilter.innerHTML = '<option value="all">All Genres</option>';
    Array.from(genreSet).sort().forEach(g => {
        const option = document.createElement('option');
        option.value = g;
        const color = colorScale(g);
        // Add colored bullet indicator (●) before genre name
        // This works better across browsers than HTML in option elements
        option.textContent = `● ${g}`;
        option.style.color = color;
        option.setAttribute('data-color', color);
        genreFilter.appendChild(option);
    });

    // Populate language filter
    const languageFilter = document.getElementById('languageFilter');
    languageFilter.innerHTML = '<option value="all">All Languages</option>';
    Array.from(languageSet).sort().forEach(l => {
        const option = document.createElement('option');
        option.value = l;
        option.textContent = l;
        languageFilter.appendChild(option);
    });

    // Set up budget slider
    const maxBudget = d3.max(rawData, d => d.budget);
    const budgetSlider = document.getElementById('minBudget');
    budgetSlider.min = MIN_SLIDER_BUDGET; // Ensure minimum is 0.1M
    budgetSlider.max = maxBudget;
    budgetSlider.value = MIN_SLIDER_BUDGET;

    // Show controls and dashboard
    document.getElementById('controls').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'grid';

    // Add event listeners
    genreFilter.addEventListener('change', () => {
        selectedGenre = null;
        updateGenreColorIndicator();
        updateVisualizations(true);
    });

    // Update color indicator when genre filter changes
    function updateGenreColorIndicator() {
        const genreColorIndicator = document.getElementById('genreColorIndicator');
        const selectedValue = genreFilter.value;
        if (selectedValue && selectedValue !== 'all' && colorScale) {
            const color = colorScale(selectedValue);
            if (genreColorIndicator) {
                genreColorIndicator.style.display = 'block';
                genreColorIndicator.style.backgroundColor = color;
            }
        } else {
            if (genreColorIndicator) {
                genreColorIndicator.style.display = 'none';
            }
        }
    }
    
    // Initialize color indicator
    updateGenreColorIndicator();
    languageFilter.addEventListener('change', () => updateVisualizations(true));
    budgetSlider.addEventListener('input', function() {
        const value = this.value / 1000000;
        document.getElementById('minBudgetValue').textContent = value.toFixed(0) + 'M';
        updateVisualizations(true);
    });
    document.getElementById('resetZoom').addEventListener('click', resetZoom);
    document.getElementById('animateBtn').addEventListener('click', animateTimeline);

    // Initial render
    updateVisualizations(false);
}

function getMainGenre(genreList) {
    // If it's already an array, use it directly
    if (Array.isArray(genreList)) {
        if (genreList.length === 0) return 'Other';
        
        // Priority order for main genres
        const priorityGenres = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 
                               'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 
                               'Mystery', 'Romance', 'Science Fiction', 'Thriller', 'War', 'Western'];
        
        for (let priority of priorityGenres) {
            if (genreList.includes(priority)) return priority;
        }
        return genreList[0] || 'Other';
    }
    
    // Fallback: if it's a string, parse it
    if (typeof genreList === 'string') {
        const parsed = parseGenres(genreList);
        return getMainGenre(parsed);
    }
    
    return 'Other';
}

function updateVisualizations(animate = true) {
    const genreFilter = document.getElementById('genreFilter').value;
    const languageFilter = document.getElementById('languageFilter').value;
    const minBudget = parseFloat(document.getElementById('minBudget').value);

    // Apply filters
    filteredData = rawData.filter(d => {
        // Genre filter - check if any genre in the list matches
        const genreMatch = genreFilter === 'all' || d.genreList.includes(genreFilter) || 
                         (selectedGenre && d.mainGenre === selectedGenre);
        const languageMatch = languageFilter === 'all' || d.language === languageFilter;
        const budgetMatch = d.budget >= minBudget;
        return genreMatch && languageMatch && budgetMatch;
    });

    console.log('Filtered data:', filteredData.length, 'movies');

    if (filteredData.length === 0) {
        return;
    }

    // Update all visualizations with animation
    updateScatterPlot(animate);
    updateGenreChart(animate);
    updateProfitChart(animate);
}

let zoom;
let xScale, yScale, g;
let lastValidTransform = null; // Track last valid zoom transform
const MIN_LOG_VALUE = 1; // Smallest value allowed on log axes
const MIN_SLIDER_BUDGET = 100000; // 0.1M minimum for slider filtering
let originalXDomain = null; // Store original domain bounds for zoom-out limit
let originalYDomain = null; // Store original domain bounds for zoom-out limit
const MAX_ZOOM_OUT_MULTIPLIER = 1; // Allow zoom-out up to 1.2x the original domain range
let maxXDataValue = null; // Store maximum x data value for pan constraint
let maxYDataValue = null; // Store maximum y data value for pan constraint
let plotWidth = null; // Store plot width for pan constraint
let plotHeight = null; // Store plot height for pan constraint

function formatCurrency(value) {
    // Format as: 1, 2, 5, 10, 20, 50, 100, ... then 1k, 2k, 5k, ... then 1M, 2M, 5M, etc.
    // Since getLogTicks generates whole numbers (1, 2, 5 at each power), we can safely assume whole numbers
    
    if (value >= 1000000000) {
        // Billions: 1B, 2B, 5B, 10B, etc.
        const billions = Math.round(value / 1000000000);
        return billions + 'B';
    } else if (value >= 1000000) {
        // Millions: 1M, 2M, 5M, 10M, 20M, 50M, 100M, etc.
        const millions = Math.round(value / 1000000);
        return millions + 'M';
    } else if (value >= 1000) {
        // Thousands: 1k, 2k, 5k, 10k, 20k, 50k, 100k, etc.
        const thousands = Math.round(value / 1000);
        return thousands + 'k';
    } else {
        // Less than 1000: 1, 2, 5, 10, 20, 50, 100, 200, 500
        return Math.round(value).toString();
    }
}

function getLogTicks(domain) {
    const [min, max] = domain;
    const ticks = [];
    const minPow = Math.floor(Math.log10(min));
    const maxPow = Math.ceil(Math.log10(max));
    const mantissas = [1, 2, 5];
    
    for (let pow = minPow; pow <= maxPow; pow++) {
        mantissas.forEach(m => {
            const value = m * Math.pow(10, pow);
            if (value >= min && value <= max) {
                ticks.push(value);
            }
        });
    }

    // Ensure min and max are included
    if (!ticks.includes(min)) ticks.unshift(min);
    if (!ticks.includes(max)) ticks.push(max);

    return ticks;
}

function updateScatterPlot(animate = true) {
    const svg = d3.select('#scatterPlot');
    const container = svg.node().parentElement;
    
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    // Calculate available height: container - title - stats box - padding
    const title = container.querySelector('.chart-title');
    const titleHeight = title ? title.getBoundingClientRect().height : 35; // fallback estimate
    const statsBoxHeight = 80; // Fixed estimate: 60px min-height + 10px margin-top + 10px padding
    const containerPadding = 24; // 12px top + 12px bottom
    
    const availableHeight = rect.height - titleHeight - statsBoxHeight - containerPadding;
    
    if (availableHeight <= 0) return; // Not enough space
    
    // Remove all groups but preserve defs (for clip paths)
    svg.selectAll('g').remove();
    
    const margin = {top: 20, right: 80, bottom: 60, left: 80};
    const width = rect.width - margin.left - margin.right;
    const height = Math.max(100, availableHeight - margin.top - margin.bottom); // Ensure minimum height

    svg.attr('width', width + margin.left + margin.right)
       .attr('height', height + margin.top + margin.bottom);

    g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create layers: background (axes, lines) and foreground (dots)
    const backgroundLayer = g.append('g').attr('class', 'background-layer');
    const foregroundLayer = g.append('g').attr('class', 'foreground-layer');
    
    // Add clip path to ensure dots only render within plot area
    // Clip path coordinates are relative to the layer (which is already translated)
    let defs = svg.select('defs');
    if (defs.empty()) {
        defs = svg.append('defs');
    }
    
    let clipPath = defs.select('#plot-clip');
    if (clipPath.empty()) {
        clipPath = defs.append('clipPath').attr('id', 'plot-clip');
    }
    clipPath.select('rect').remove();
    clipPath.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height);
    
    foregroundLayer.attr('clip-path', 'url(#plot-clip)');

    // Scales - use rawData so scales don't change when filtering
    // For log scales, domain must be strictly positive and properly set
    const budgetExtent = d3.extent(rawData, d => d.budget);
    const revenueExtent = d3.extent(rawData, d => d.revenue);
    
    // Store maximum data values for pan constraints
    maxXDataValue = budgetExtent[1] || MIN_LOG_VALUE * 10;
    maxYDataValue = revenueExtent[1] || MIN_LOG_VALUE * 10;
    plotWidth = width;
    plotHeight = height;
    
    // Ensure minimum values are at least MIN_LOG_VALUE
    const xExtentMin = budgetExtent[0] || MIN_LOG_VALUE;
    const xExtentMax = budgetExtent[1] || xExtentMin * 10;
    const xDomainMin = Math.max(MIN_LOG_VALUE, xExtentMin);
    const xDomainMax = Math.max(xDomainMin * 1.01, xExtentMax); // avoid identical min/max
    
    // For log scales, set domain first, then nice() rounds to nice powers
    xScale = d3.scaleLog()
        .base(10)
        .domain([xDomainMin, xDomainMax])
        .range([0, width])
        .nice();

    // Revenue scale - ensure positive values
    const yExtentMin = revenueExtent[0] || MIN_LOG_VALUE;
    const yExtentMax = revenueExtent[1] || yExtentMin * 10;
    const yDomainMin = Math.max(MIN_LOG_VALUE, yExtentMin); // Log scale needs > 0
    const yDomainMax = Math.max(yDomainMin * 1.01, yExtentMax);
    
    yScale = d3.scaleLog()
        .base(10)
        .domain([yDomainMin, yDomainMax])
        .range([height, 0])
        .nice();

    // Store original domain bounds (after nice()) to limit zoom-out
    originalXDomain = xScale.domain().slice(); // Create a copy of the domain
    originalYDomain = yScale.domain().slice(); // Create a copy of the domain

    // Add zoom behavior with filter to prevent going below MIN_LOG_VALUE
    zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .extent([[0, 0], [width, height]])
        .filter(function(event) {
            // Allow all events, we'll constrain in zoomed function
            return true;
        })
        .on('zoom', zoomed);

    svg.call(zoom);
    
    // Initialize last valid transform
    lastValidTransform = d3.zoomIdentity;

    // Axes - custom tick values for log scale to avoid clutter
    const xTicks = getLogTicks(xScale.domain());
    const yTicks = getLogTicks(yScale.domain());
    
    // Remove the minimum and maximum values from x-axis ticks to reduce clutter at edges
    const xDomainForTicks = xScale.domain();
    const xTicksFiltered = xTicks.filter(tick => {
        return tick !== xDomainForTicks[0] && tick !== xDomainForTicks[1];
    });
    
    // Remove the minimum and maximum values from y-axis ticks to reduce clutter at edges
    const yDomainForTicks = yScale.domain();
    const yTicksFiltered = yTicks.filter(tick => {
        return tick !== yDomainForTicks[0] && tick !== yDomainForTicks[1];
    });

    const xAxis = d3.axisBottom(xScale)
        .tickValues(xTicksFiltered)
        .tickFormat(formatCurrency);
    
    const yAxis = d3.axisLeft(yScale)
        .tickValues(yTicksFiltered)
        .tickFormat(formatCurrency);

    // Add axes to background layer
    const xAxisG = backgroundLayer.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis);

    const yAxisG = backgroundLayer.append('g')
        .attr('class', 'y-axis')
        .call(yAxis);

    // Axis labels
    backgroundLayer.append('text')
        .attr('class', 'axis-label')
        .attr('x', width / 2)
        .attr('y', height + 45)
        .attr('text-anchor', 'middle')
        .text('Budget (Log Scale)');

    backgroundLayer.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -60)
        .attr('text-anchor', 'middle')
        .text('Revenue (Log Scale)');

    // Break-even line (y = x, where revenue = budget)
    const xDomain = xScale.domain();
    const yDomain = yScale.domain();
    // Use the intersection of both domains for the line
    const lineMin = Math.max(xDomain[0], yDomain[0]);
    const lineMax = Math.min(xDomain[1], yDomain[1]);

    backgroundLayer.append('line')
        .attr('class', 'break-even-line')
        .attr('x1', xScale(lineMin))
        .attr('y1', yScale(lineMin))
        .attr('x2', xScale(lineMax))
        .attr('y2', yScale(lineMax))
        .attr('stroke', '#95a5a6')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('opacity', 0.5);

    // Break-even label positioned at the end of the line
    const labelX = xScale(lineMax) - 10;
    const labelY = yScale(lineMax) + 20;
    backgroundLayer.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'end')
        .attr('fill', '#95a5a6')
        .style('font-size', '11px')
        .text('Break-even line');

    // Tooltip
    const tooltip = d3.select('#tooltip');

    // Dots container in foreground layer (renders on top)
    const dotsContainer = foregroundLayer.append('g').attr('class', 'dots-container');

    // Add dots
    const dots = dotsContainer.selectAll('.dot')
        .data(filteredData, d => d.id);

    const dotsEnter = dots.enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('r', 0)
        .attr('cx', d => xScale(d.budget))
        .attr('cy', d => yScale(d.revenue))
        .attr('fill', d => colorScale(d.mainGenre))
        .attr('opacity', 0.6);

    // Merge enter and update selections
    const allDots = dotsEnter.merge(dots);

    // Apply animation
    if (animate) {
        allDots.transition()
            .duration(800)
            .delay((d, i) => Math.min(i * 2, 500))
            .attr('r', 4)
            .attr('cx', d => xScale(d.budget))
            .attr('cy', d => yScale(d.revenue))
            .attr('fill', d => colorScale(d.mainGenre));
    } else {
        allDots.attr('r', 4);
    }

    // Add interactions
    allDots
        .on('mouseover', function(event, d) {
            // Highlight dot
            d3.select(this)
                .transition()
                .duration(200)
                .attr('r', 8)
                .attr('opacity', 1);

            // Show tooltip
            tooltip.style('opacity', '1');
            tooltip.html(`<strong>${d.title}</strong><br/>
                Budget: $${(d.budget / 1000000).toFixed(1)}M<br/>
                Revenue: $${(d.revenue / 1000000).toFixed(1)}M<br/>
                ROI: ${d.roi.toFixed(1)}%<br/>
                Profit: $${(d.profit / 1000000).toFixed(1)}M<br/>
                Genres: ${d.genres}<br/>
                Language: ${d.language}<br/>
                Runtime: ${d.runtime} min`);
            
            tooltip.style('left', (event.pageX + 10) + 'px')
                   .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('r', 4)
                .attr('opacity', 0.6);

            tooltip.style('opacity', '0');
        })
        .on('click', function(event, d) {
            // Highlight similar genre movies
            highlightGenre(d.mainGenre);
        });

    // Remove exit selection
    dots.exit()
        .transition()
        .duration(500)
        .attr('r', 0)
        .remove();
}

function zoomed(event) {
    const {transform} = event;
    
    // Update scales
    let newXScale = transform.rescaleX(xScale);
    const newYScale = transform.rescaleY(yScale);
    
    // Constrain axes to never go below MIN_LOG_VALUE (log scales can't handle <= 0)
    const currentXDomain = newXScale.domain();
    const currentYDomain = newYScale.domain();
    
    if (currentXDomain[0] < MIN_LOG_VALUE || currentYDomain[0] < MIN_LOG_VALUE) {
        // Reject this transform - reset to last valid transform or identity
        const svg = d3.select('#scatterPlot');
        if (lastValidTransform) {
            svg.call(zoom.transform, lastValidTransform);
        } else {
            svg.call(zoom.transform, d3.zoomIdentity);
        }
        return; // Exit early
    }
    
    // Limit zoom-out: prevent zooming out beyond the original domain bounds
    if (originalXDomain && originalYDomain) {
        // For log scales, calculate range in log space (proper way to measure range for log scales)
        const originalXLogRange = Math.log10(originalXDomain[1]) - Math.log10(originalXDomain[0]);
        const originalYLogRange = Math.log10(originalYDomain[1]) - Math.log10(originalYDomain[0]);
        const currentXLogRange = Math.log10(currentXDomain[1]) - Math.log10(currentXDomain[0]);
        const currentYLogRange = Math.log10(currentYDomain[1]) - Math.log10(currentYDomain[0]);
        
        // Check if zoomed out too far (range is larger than original range * multiplier)
        const maxXLogRange = originalXLogRange * MAX_ZOOM_OUT_MULTIPLIER;
        const maxYLogRange = originalYLogRange * MAX_ZOOM_OUT_MULTIPLIER;
        
        if (currentXLogRange > maxXLogRange || currentYLogRange > maxYLogRange) {
            // Reject this transform - reset to last valid transform
            const svg = d3.select('#scatterPlot');
            if (lastValidTransform) {
                svg.call(zoom.transform, lastValidTransform);
            } else {
                svg.call(zoom.transform, d3.zoomIdentity);
            }
            return; // Exit early
        }
    }
    
    // Limit panning: prevent panning beyond data boundaries
    // X-axis: prevent panning left when max x data value would go beyond left edge (x = 0)
    // Y-axis: prevent panning down when max y data value would go beyond bottom edge
    //   For inverted y-axis (range [height, 0]): bottom is at y = height
    //   When domain min increases (panning down), maxYDataValue maps to larger y positions
    //   When domain min reaches maxYDataValue, maxYPosition = height (max value at bottom edge)
    //   Further panning would make maxYPosition > height (max value below bottom, should prevent)
    if (maxXDataValue !== null && maxYDataValue !== null && plotWidth !== null && plotHeight !== null) {
        const maxXPosition = newXScale(maxXDataValue);
        const maxYPosition = newYScale(maxYDataValue);
        
        // X-axis: prevent panning when max x value would be beyond left edge
        const xViolated = maxXPosition < 0;
        
        // Y-axis: prevent panning when max y value would be below bottom edge
        // maxYPosition > plotHeight means max value is below bottom (not visible, should prevent)
        const yViolated = maxYPosition > plotHeight;
        
        if (xViolated || yViolated) {
            // Reject this transform - reset to last valid transform
            // This prevents panning beyond the point where max values reach the edges
            const svg = d3.select('#scatterPlot');
            if (lastValidTransform) {
                svg.call(zoom.transform, lastValidTransform);
            } else {
                svg.call(zoom.transform, d3.zoomIdentity);
            }
            return; // Exit early
        }
    }
    
    // This transform is valid - save it
    lastValidTransform = transform;
    
    // Update axes - use same formatting as initial axes
    const xTicks = getLogTicks(newXScale.domain());
    const yTicks = getLogTicks(newYScale.domain());
    
    // Remove the minimum and maximum values from x-axis ticks to reduce clutter at edges
    const newXDomainForTicks = newXScale.domain();
    const xTicksFiltered = xTicks.filter(tick => {
        return tick !== newXDomainForTicks[0] && tick !== newXDomainForTicks[1];
    });
    
    // Remove the minimum and maximum values from y-axis ticks to reduce clutter at edges
    const newYDomainForTicks = newYScale.domain();
    const yTicksFiltered = yTicks.filter(tick => {
        return tick !== newYDomainForTicks[0] && tick !== newYDomainForTicks[1];
    });

    g.select('.x-axis').call(d3.axisBottom(newXScale)
        .tickValues(xTicksFiltered)
        .tickFormat(formatCurrency));
    
    g.select('.y-axis').call(d3.axisLeft(newYScale)
        .tickValues(yTicksFiltered)
        .tickFormat(formatCurrency));
    
    // Update dots
    g.selectAll('.dot')
        .attr('cx', d => newXScale(d.budget))
        .attr('cy', d => newYScale(d.revenue));
    
    // Update break-even line (y = x, where revenue = budget)
    const newXDomain = newXScale.domain();
    const newYDomain = newYScale.domain();
    const lineMin = Math.max(newXDomain[0], newYDomain[0]);
    const lineMax = Math.min(newXDomain[1], newYDomain[1]);
    
    g.select('.break-even-line')
        .attr('x1', newXScale(lineMin))
        .attr('y1', newYScale(lineMin))
        .attr('x2', newXScale(lineMax))
        .attr('y2', newYScale(lineMax));
}

function resetZoom() {
    const svg = d3.select('#scatterPlot');
    lastValidTransform = d3.zoomIdentity; // Reset tracked transform
    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
}

function updateGenreChart(animate = true) {
    const svg = d3.select('#genreChart');
    const container = svg.node().parentElement;
    
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    svg.selectAll('*').remove();
    
    const margin = {top: 20, right: 20, bottom: 60, left: 60};
    const width = rect.width - margin.left - margin.right;
    const height = rect.height - margin.top - margin.bottom;

    const g = svg.attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Calculate genre statistics
    const genreData = d3.rollup(
        filteredData,
        v => ({
            count: v.length,
            avgROI: d3.mean(v, d => d.roi),
            avgProfit: d3.mean(v, d => d.profit),
            totalRevenue: d3.sum(v, d => d.revenue)
        }),
        d => d.mainGenre
    );

    const data = Array.from(genreData, ([genre, stats]) => ({
        genre: genre,
        avgROI: stats.avgROI,
        count: stats.count,
        avgProfit: stats.avgProfit
    })).sort((a, b) => b.avgROI - a.avgROI).slice(0, 10);

    // Scales
    const xScale = d3.scaleBand()
        .domain(data.map(d => d.genre))
        .range([0, width])
        .padding(0.2);

    const yScale = d3.scaleLinear()
        .domain([d3.min(data, d => d.avgROI) < 0 ? d3.min(data, d => d.avgROI) : 0, 
                d3.max(data, d => d.avgROI)])
        .range([height, 0])
        .nice();

    // Axes
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-size', '10px')
        .attr('transform', 'rotate(-45)')
        .attr('text-anchor', 'end');

    g.append('g')
        .call(d3.axisLeft(yScale).ticks(5))
        .selectAll('text')
        .style('font-size', '11px');

    // Axis label
    g.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -45)
        .attr('text-anchor', 'middle')
        .text('Average ROI (%)');

    // Zero line if needed
    if (d3.min(data, d => d.avgROI) < 0) {
        g.append('line')
            .attr('x1', 0)
            .attr('y1', yScale(0))
            .attr('x2', width)
            .attr('y2', yScale(0))
            .attr('stroke', '#333')
            .attr('stroke-width', 1);
    }

    const tooltip = d3.select('#tooltip');

    // Bars
    const bars = g.selectAll('.bar')
        .data(data);

    const barsEnter = bars.enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.genre))
        .attr('y', d => d.avgROI >= 0 ? height : yScale(d.avgROI))
        .attr('width', xScale.bandwidth())
        .attr('height', 0)
        .attr('fill', d => colorScale(d.genre));

    if (animate) {
        barsEnter.transition()
            .duration(800)
            .delay((d, i) => i * 50)
            .attr('y', d => d.avgROI >= 0 ? yScale(d.avgROI) : yScale(0))
            .attr('height', d => Math.abs(yScale(d.avgROI) - yScale(0)));
    } else {
        barsEnter
            .attr('y', d => d.avgROI >= 0 ? yScale(d.avgROI) : yScale(0))
            .attr('height', d => Math.abs(yScale(d.avgROI) - yScale(0)));
    }

    // Add interactions
    barsEnter
        .on('mouseover', function(event, d) {
            tooltip.style('opacity', '1');
            tooltip.html(`<strong>${d.genre}</strong><br/>
                Avg ROI: ${d.avgROI.toFixed(1)}%<br/>
                Avg Profit: $${(d.avgProfit / 1000000).toFixed(1)}M<br/>
                Movies: ${d.count}`);
            tooltip.style('left', (event.pageX + 10) + 'px')
                   .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            tooltip.style('opacity', '0');
        })
        .on('click', function(event, d) {
            // Toggle genre selection
            if (selectedGenre === d.genre) {
                selectedGenre = null;
                d3.selectAll('.bar').classed('selected', false);
            } else {
                selectedGenre = d.genre;
                d3.selectAll('.bar').classed('selected', false);
                d3.select(this).classed('selected', true);
            }
            highlightGenre(selectedGenre);
        });
}

function highlightGenre(genre) {
    if (!genre) {
        // Remove all highlights
        d3.selectAll('.dot')
            .classed('highlighted', false)
            .classed('dimmed', false)
            .transition()
            .duration(300)
            .attr('opacity', 0.6);
    } else {
        // Highlight matching genre
        d3.selectAll('.dot')
            .classed('highlighted', d => d.mainGenre === genre)
            .classed('dimmed', d => d.mainGenre !== genre)
            .transition()
            .duration(300)
            .attr('opacity', d => d.mainGenre === genre ? 1 : 0.2);
    }
}

function updateProfitChart(animate = true) {
    const svg = d3.select('#profitChart');
    const container = svg.node().parentElement;
    
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    svg.selectAll('*').remove();
    
    const margin = {top: 20, right: 20, bottom: 50, left: 60};
    const width = rect.width - margin.left - margin.right;
    const height = rect.height - margin.top - margin.bottom;

    const g = svg.attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Calculate profit distribution
    const profitable = filteredData.filter(d => d.profit > 0).length;
    const unprofitable = filteredData.filter(d => d.profit <= 0).length;
    
    const data = [
        {category: 'Profitable', count: profitable, color: '#27ae60'},
        {category: 'Loss', count: unprofitable, color: '#e74c3c'}
    ];

    // Scales
    const xScale = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, width])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .range([height, 0])
        .nice();

    // Axes
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-size', '12px');

    g.append('g')
        .call(d3.axisLeft(yScale).ticks(5))
        .selectAll('text')
        .style('font-size', '11px');

    // Bars
    const bars = g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.category))
        .attr('y', height)
        .attr('width', xScale.bandwidth())
        .attr('height', 0)
        .attr('fill', d => d.color);

    if (animate) {
        bars.transition()
            .duration(800)
            .attr('y', d => yScale(d.count))
            .attr('height', d => height - yScale(d.count));
    } else {
        bars.attr('y', d => yScale(d.count))
            .attr('height', d => height - yScale(d.count));
    }

    // Add value labels on bars
    g.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.count) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text(d => d.count)
        .style('opacity', 0);

    if (animate) {
        g.selectAll('.bar-label')
            .transition()
            .delay(800)
            .duration(300)
            .style('opacity', 1);
    } else {
        g.selectAll('.bar-label').style('opacity', 1);
    }

    // Update stats box
    const avgROI = d3.mean(filteredData, d => d.roi);
    const avgBudget = d3.mean(filteredData, d => d.budget);
    const avgRevenue = d3.mean(filteredData, d => d.revenue);
    const successRate = (profitable / filteredData.length) * 100;

    document.getElementById('statsBox').innerHTML = 
        `<div class="stat">
            <div>Average ROI</div>
            <div class="stat-value">${avgROI.toFixed(1)}%</div>
        </div>
        <div class="stat">
            <div>Avg Budget</div>
            <div class="stat-value">$${(avgBudget / 1000000).toFixed(1)}M</div>
        </div>
        <div class="stat">
            <div>Success Rate</div>
            <div class="stat-value">${successRate.toFixed(1)}%</div>
        </div>`;
}

function animateTimeline() {
    if (isAnimating) return;
    
    isAnimating = true;
    const btn = document.getElementById('animateBtn');
    btn.textContent = 'Stop Animation';
    btn.onclick = stopAnimation;
    
    // Group data by budget ranges and animate through them
    const budgetRanges = [0, 1000000, 5000000, 10000000, 25000000, 50000000, 100000000, 200000000];
    let currentRange = 0;
    
    function animateRange() {
        if (!isAnimating || currentRange >= budgetRanges.length - 1) {
            stopAnimation();
            return;
        }
        
        const slider = document.getElementById('minBudget');
        const maxBudget = budgetRanges[currentRange + 1];
        
        // Animate slider
        slider.value = budgetRanges[currentRange];
        document.getElementById('minBudgetValue').textContent = 
            (budgetRanges[currentRange] / 1000000).toFixed(0) + 'M';
        
        // Filter to show only movies in current range
        filteredData = rawData.filter(d => 
            d.budget >= budgetRanges[currentRange] && 
            d.budget < maxBudget
        );
        
        // Update visualizations with animation
        if (filteredData.length > 0) {
            updateScatterPlot(true);
            updateGenreChart(true);
            updateProfitChart(true);
        }
        
        currentRange++;
        setTimeout(animateRange, 2000);
    }
    
    animateRange();
}

function stopAnimation() {
    isAnimating = false;
    const btn = document.getElementById('animateBtn');
    btn.textContent = 'Play Timeline';
    btn.onclick = animateTimeline;
    
    // Reset to show all data
    document.getElementById('minBudget').value = MIN_SLIDER_BUDGET;
    document.getElementById('minBudgetValue').textContent = '0.1M';
    updateVisualizations(true);
}

// Auto-load cleaned.csv when data visualization is shown
function autoLoadData() {
    const dataViz = document.getElementById('dataVisualization');
    if (!dataViz || dataViz.style.display === 'none') {
        return; // Don't load if not visible
    }
    
    fetch('cleaned.csv')
        .then(response => {
            if (!response.ok) throw new Error('No cleaned.csv found');
            return response.text();
        })
        .then(csvText => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    processData(results.data);
                }
            });
        })
        .catch(err => {
            console.log('cleaned.csv not found, waiting for manual upload.');
        });
}

// Expose autoLoadData globally so frontpage.js can call it
window.autoLoadData = autoLoadData;

