// Global variables
let rawData = [];
let filteredData = [];
let selectedGenre = null;
let isAnimating = false;
let dataLoading = false; // Flag to prevent duplicate loads
let dataLoaded = false; // Flag to track if data has been loaded

// Global color scale for genres - will be initialized dynamically
let colorScale;

// Language code to full name mapping (ISO 639-1)
const languageNames = {
    'ab': 'Abkhazian',
    'af': 'Afrikaans',
    'am': 'Amharic',
    'ar': 'Arabic',
    'ay': 'Aymara',
    'bg': 'Bulgarian',
    'bm': 'Bambara',
    'bn': 'Bengali',
    'bo': 'Tibetan',
    'bs': 'Bosnian',
    'ca': 'Catalan',
    'cn': 'Cantonese',
    'cs': 'Czech',
    'cy': 'Welsh',
    'da': 'Danish',
    'de': 'German',
    'el': 'Greek',
    'en': 'English',
    'eo': 'Esperanto',
    'es': 'Spanish',
    'et': 'Estonian',
    'eu': 'Basque',
    'fa': 'Persian',
    'fi': 'Finnish',
    'fr': 'French',
    'fy': 'Western Frisian',
    'gl': 'Galician',
    'he': 'Hebrew',
    'hi': 'Hindi',
    'hr': 'Croatian',
    'hu': 'Hungarian',
    'hy': 'Armenian',
    'id': 'Indonesian',
    'is': 'Icelandic',
    'it': 'Italian',
    'iu': 'Inuktitut',
    'ja': 'Japanese',
    'jv': 'Javanese',
    'ka': 'Georgian',
    'kk': 'Kazakh',
    'kn': 'Kannada',
    'ko': 'Korean',
    'ku': 'Kurdish',
    'ky': 'Kyrgyz',
    'la': 'Latin',
    'lb': 'Luxembourgish',
    'lo': 'Lao',
    'lt': 'Lithuanian',
    'lv': 'Latvian',
    'mk': 'Macedonian',
    'ml': 'Malayalam',
    'mn': 'Mongolian',
    'mr': 'Marathi',
    'ms': 'Malay',
    'mt': 'Maltese',
    'nb': 'Norwegian Bokmål',
    'ne': 'Nepali',
    'nl': 'Dutch',
    'no': 'Norwegian',
    'pa': 'Punjabi',
    'pl': 'Polish',
    'ps': 'Pashto',
    'pt': 'Portuguese',
    'qu': 'Quechua',
    'ro': 'Romanian',
    'ru': 'Russian',
    'rw': 'Kinyarwanda',
    'sh': 'Serbo-Croatian',
    'si': 'Sinhala',
    'sk': 'Slovak',
    'sl': 'Slovenian',
    'sm': 'Samoan',
    'sq': 'Albanian',
    'sr': 'Serbian',
    'sv': 'Swedish',
    'ta': 'Tamil',
    'te': 'Telugu',
    'tg': 'Tajik',
    'th': 'Thai',
    'tl': 'Tagalog',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'ur': 'Urdu',
    'uz': 'Uzbek',
    'vi': 'Vietnamese',
    'wo': 'Wolof',
    'xx': 'No Language',
    'zh': 'Chinese',
    'zu': 'Zulu'
};

/**
 * Get full language name from ISO 639-1 code
 * @param {string} code - ISO 639-1 language code
 * @returns {string} Full language name or the code if not found
 */
function getLanguageName(code) {
    if (!code || code === 'Unknown') return 'Unknown';
    // Handle numeric values that might appear in the data
    if (!isNaN(code)) return code;
    return languageNames[code.toLowerCase()] || code.toUpperCase();
}

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
        // Parse release date
        let releaseYear = null;
        let releaseDateStr = null;
        
        if (d.release_date) {
            // If it's a Date object (from PapaParse dynamicTyping)
            if (d.release_date instanceof Date) {
                releaseYear = d.release_date.getFullYear();
                releaseDateStr = d.release_date.toISOString().split('T')[0];
            } 
            // If it's a string
            else if (typeof d.release_date === 'string') {
                releaseDateStr = d.release_date.trim();
                const yearMatch = releaseDateStr.match(/^(\d{4})/);
                if (yearMatch) {
                    releaseYear = parseInt(yearMatch[1]);
                }
            }
        }
        
        return {
        id: d.id,
        title: d.title || 'Unknown',
        budget: parseFloat(d.budget),
        revenue: parseFloat(d.revenue),
        runtime: parseFloat(d.runtime),
        genres: d.genres || 'Unknown',
            genreList: genreList,
        language: d.original_language || 'Unknown',
            releaseYear: releaseYear,
            releaseDate: releaseDateStr, // Store original date string for display
        roi: ((parseFloat(d.revenue) - parseFloat(d.budget)) / parseFloat(d.budget)) * 100,
        profit: parseFloat(d.revenue) - parseFloat(d.budget),
            mainGenre: getMainGenre(genreList)
        };
    });

    console.log('Loaded', rawData.length, 'valid movies');

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
    // Sort languages by full name for better UX
    Array.from(languageSet).sort((a, b) => {
        const nameA = getLanguageName(a);
        const nameB = getLanguageName(b);
        return nameA.localeCompare(nameB);
    }).forEach(l => {
        const option = document.createElement('option');
        option.value = l; // Keep the code as the value for filtering
        option.textContent = getLanguageName(l); // Display full name
        languageFilter.appendChild(option);
    });

    // Set up budget sliders
    const maxBudgetValue = d3.max(rawData, d => d.budget);
    const minBudgetSlider = document.getElementById('minBudget');
    const maxBudgetSlider = document.getElementById('maxBudget');
    const minBudgetValue = document.getElementById('minBudgetValue');
    const maxBudgetValueElement = document.getElementById('maxBudgetValue');
    
    // Set up min budget slider
    minBudgetSlider.min = MIN_SLIDER_BUDGET;
    minBudgetSlider.max = maxBudgetValue;
    minBudgetSlider.value = MIN_SLIDER_BUDGET;
    
    // Set up max budget slider
    maxBudgetSlider.min = MIN_SLIDER_BUDGET;
    maxBudgetSlider.max = maxBudgetValue;
    maxBudgetSlider.value = maxBudgetValue;
    
    // Update display values
    if (minBudgetValue) {
        minBudgetValue.textContent = (MIN_SLIDER_BUDGET / 1000000).toFixed(1) + 'M';
    }
    if (maxBudgetValueElement) {
        maxBudgetValueElement.textContent = (maxBudgetValue / 1000000).toFixed(0) + 'M';
    }

    // Set up date range sliders - extract years directly from data
    const years = rawData.map(d => d.releaseYear).filter(y => y !== null && y !== undefined);
    const minYear = years.length > 0 ? d3.min(years) : 1900;
    const maxYear = years.length > 0 ? d3.max(years) : new Date().getFullYear();
    
    const minDateSlider = document.getElementById('minDate');
    const maxDateSlider = document.getElementById('maxDate');
    const minDateValue = document.getElementById('minDateValue');
    const maxDateValue = document.getElementById('maxDateValue');
    
    if (minDateSlider && maxDateSlider) {
        minDateSlider.min = minYear;
        minDateSlider.max = maxYear;
        minDateSlider.value = minYear;
        
        maxDateSlider.min = minYear;
        maxDateSlider.max = maxYear;
        maxDateSlider.value = maxYear;
        
        if (minDateValue) minDateValue.textContent = minYear;
        if (maxDateValue) maxDateValue.textContent = maxYear;
        
        // Date range slider event listeners
        minDateSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            minDateValue.textContent = value;
            // Ensure min date doesn't exceed max date
            if (value > parseInt(maxDateSlider.value)) {
                maxDateSlider.value = value;
                maxDateValue.textContent = value;
            }
            updateVisualizations(true);
        });
        
        maxDateSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            maxDateValue.textContent = value;
            // Ensure max date doesn't go below min date
            if (value < parseInt(minDateSlider.value)) {
                minDateSlider.value = value;
                minDateValue.textContent = value;
            }
            updateVisualizations(true);
        });
    }
    
    // Sample size slider event listener
    const sampleSlider = document.getElementById('sampleSize');
    const sampleValue = document.getElementById('sampleSizeValue');
    if (sampleSlider && sampleValue) {
        sampleSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            sampleValue.textContent = value;
            updateVisualizations(true);
        });
    }
    
    // Regenerate sample button event listener
    const regenerateBtn = document.getElementById('regenerateSample');
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', function() {
            updateVisualizations(true);
        });
    }

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
    
    // Budget slider event listeners
    minBudgetSlider.addEventListener('input', function() {
        const value = parseFloat(this.value);
        minBudgetValue.textContent = (value / 1000000).toFixed(1) + 'M';
        // Ensure min budget doesn't exceed max budget
        if (value > parseFloat(maxBudgetSlider.value)) {
            maxBudgetSlider.value = value;
            maxBudgetValueElement.textContent = (value / 1000000).toFixed(0) + 'M';
        }
        updateVisualizations(true);
    });
    
    maxBudgetSlider.addEventListener('input', function() {
        const value = parseFloat(this.value);
        maxBudgetValueElement.textContent = (value / 1000000).toFixed(0) + 'M';
        // Ensure max budget doesn't go below min budget
        if (value < parseFloat(minBudgetSlider.value)) {
            minBudgetSlider.value = value;
            minBudgetValue.textContent = (value / 1000000).toFixed(1) + 'M';
        }
        updateVisualizations(true);
    });
    
    const resetZoomBtn = document.getElementById('resetZoom');
    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', resetZoom);
    }
    
    // animateBtn was removed from HTML, so skip if it doesn't exist
    const animateBtn = document.getElementById('animateBtn');
    if (animateBtn) {
        animateBtn.addEventListener('click', animateTimeline);
    }

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
    const maxBudget = parseFloat(document.getElementById('maxBudget').value);
    const minDateYear = parseInt(document.getElementById('minDate').value);
    const maxDateYear = parseInt(document.getElementById('maxDate').value);

    // Apply filters
    filteredData = rawData.filter(d => {
        // Genre filter
        const genreMatch = genreFilter === 'all' || d.genreList.includes(genreFilter) || 
                         (selectedGenre && d.mainGenre === selectedGenre);
        // Language filter
        const languageMatch = languageFilter === 'all' || d.language === languageFilter;
        // Budget filter - range between min and max
        const budgetMatch = d.budget >= minBudget && d.budget <= maxBudget;
        // Date filter - movies MUST have a valid year and be in range
        const dateMatch = d.releaseYear && d.releaseYear > 0 && d.releaseYear >= minDateYear && d.releaseYear <= maxDateYear;
        
        return genreMatch && languageMatch && budgetMatch && dateMatch;
    });

    console.log('Filtered data:', filteredData.length, 'movies');

    // Update sample size slider max value based on filtered data
    const sampleSlider = document.getElementById('sampleSize');
    const sampleValue = document.getElementById('sampleSizeValue');
    if (sampleSlider && sampleValue && filteredData.length > 0) {
        const currentSample = parseInt(sampleSlider.value);
        sampleSlider.max = filteredData.length;
        
        // If current sample is larger than available data, adjust it
        if (currentSample > filteredData.length) {
            sampleSlider.value = filteredData.length;
            sampleValue.textContent = filteredData.length;
        }
        
        // Apply random sampling
        const sampleSize = Math.min(parseInt(sampleSlider.value), filteredData.length);
        if (sampleSize < filteredData.length) {
            // Random sample using Fisher-Yates shuffle (partial)
            const sampled = [...filteredData];
            for (let i = sampled.length - 1; i > sampled.length - sampleSize - 1; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [sampled[i], sampled[j]] = [sampled[j], sampled[i]];
            }
            filteredData = sampled.slice(-sampleSize);
        }
    }

    // Update all visualizations with animation (even if no data)
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
    
    if (value >= 1000000000000) {
        // Trillions: 1T, 2T, 5T, 10T, etc.
        const trillions = Math.round(value / 1000000000000);
        return trillions + 'T';
    } else if (value >= 1000000000) {
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
    
    // Store maximum data values for pan constraints - use filteredData so constraints apply to visible data
    const filteredBudgetExtent = filteredData.length > 0 ? d3.extent(filteredData, d => d.budget) : budgetExtent;
    const filteredRevenueExtent = filteredData.length > 0 ? d3.extent(filteredData, d => d.revenue) : revenueExtent;
    maxXDataValue = filteredBudgetExtent[1] || budgetExtent[1] || MIN_LOG_VALUE * 10;
    maxYDataValue = filteredRevenueExtent[1] || revenueExtent[1] || MIN_LOG_VALUE * 10;
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

    // Check if there's no data to display
    if (filteredData.length === 0) {
        // Remove any existing "no data" message
        foregroundLayer.selectAll('.no-data-message').remove();
        
        // Display "No data" message in the center of the plot
        foregroundLayer.append('text')
            .attr('class', 'no-data-message')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '24px')
            .style('font-weight', 'bold')
            .style('fill', '#95a5a6')
            .style('opacity', 0)
            .text('No data available for selected filters')
            .transition()
            .duration(animate ? 500 : 0)
            .style('opacity', 1);
        
        // Clear any existing dots
        foregroundLayer.selectAll('.dot').remove();
        
        // Update stats box to show no data
        const statsBox = document.getElementById('statsBox');
        if (statsBox) {
            statsBox.innerHTML = 
                `<div class="stat">
                    <div>Average ROI</div>
                    <div class="stat-value">N/A</div>
                </div>
                <div class="stat">
                    <div>Avg Budget</div>
                    <div class="stat-value">N/A</div>
                </div>
                <div class="stat">
                    <div>Success Rate</div>
                    <div class="stat-value">N/A</div>
                </div>`;
        }
        return;
    }

    // Remove any existing "no data" message
    foregroundLayer.selectAll('.no-data-message').remove();

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
            const releaseDateInfo = d.releaseDate ? `Release Date: ${d.releaseDate} (${d.releaseYear})<br/>` : '';
            tooltip.html(`<strong>${d.title}</strong><br/>
                Budget: $${(d.budget / 1000000).toFixed(1)}M<br/>
                Revenue: $${(d.revenue / 1000000).toFixed(1)}M<br/>
                ROI: ${d.roi.toFixed(1)}%<br/>
                Profit: $${(d.profit / 1000000).toFixed(1)}M<br/>
                ${releaseDateInfo}Genres: ${d.genres}<br/>
                Language: ${getLanguageName(d.language)}<br/>
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
    
    // Limit panning: prevent panning beyond center for max values
    // X-axis: prevent panning left when max x data value would go beyond center (x = width/2)
    // Y-axis: prevent panning down when max y data value would go beyond center (y = height/2)
    //   For inverted y-axis (range [height, 0]): center is at y = height/2
    //   When domain min increases (panning down), maxYDataValue maps to larger y positions
    //   We want to prevent maxYPosition from going below the center (height/2)
    if (maxXDataValue !== null && maxYDataValue !== null && plotWidth !== null && plotHeight !== null) {
        const maxXPosition = newXScale(maxXDataValue);
        const maxYPosition = newYScale(maxYDataValue);
        
        // X-axis: prevent panning when max x value would be beyond center (to the left)
        const xViolated = maxXPosition < plotWidth / 2;
        
        // Y-axis: prevent panning when max y value would be below center (toward bottom)
        // maxYPosition > plotHeight/2 means max value is below center, should prevent
        const yViolated = maxYPosition > plotHeight / 2;
        
        if (xViolated || yViolated) {
            // Reject this transform - reset to last valid transform
            // This prevents panning beyond the point where max values reach the center
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
    
    // Increased bottom margin significantly for rotated text labels
    const margin = {top: 20, right: 20, bottom: 100, left: 60};
    const width = rect.width - margin.left - margin.right;
    // Reduce the effective chart height to leave more room for rotated labels at bottom
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

    // Filter out genres with invalid avgROI and ensure valid numeric values
    const data = Array.from(genreData, ([genre, stats]) => {
        // Only include genres with valid avgROI values
        const avgROI = stats.avgROI != null && !isNaN(stats.avgROI) ? stats.avgROI : null;
        const avgProfit = stats.avgProfit != null && !isNaN(stats.avgProfit) ? stats.avgProfit : 0;
        
        // Return null for genres with invalid ROI to filter them out
        if (avgROI === null || stats.count === 0) {
            return null;
        }
        
        return {
        genre: genre,
            avgROI: avgROI,
        count: stats.count,
            avgProfit: avgProfit
        };
    })
    .filter(d => d !== null) // Remove genres with invalid ROI
    .sort((a, b) => b.avgROI - a.avgROI) // Sort by ROI (descending)
    .slice(0, 10);

    // Check if there's no data
    if (data.length === 0 || filteredData.length === 0) {
        g.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '18px')
            .style('font-weight', 'bold')
            .style('fill', '#95a5a6')
            .style('opacity', 0)
            .text('No data available')
            .transition()
            .duration(animate ? 500 : 0)
            .style('opacity', 1);
        return;
    }

    // Scales
    const xScale = d3.scaleBand()
        .domain(data.map(d => d.genre))
        .range([0, width])
        .padding(0.2);

    // Adjust x-axis position to move it up a bit, leaving more room for rotated labels
    const xAxisYPosition = height - 15; // Move axis up by 15px to give more space below
    
    // Calculate domain with proper handling of valid numeric values
    const validROIs = data.map(d => d.avgROI).filter(roi => roi != null && !isNaN(roi));
    const minROI = validROIs.length > 0 ? d3.min(validROIs) : 0;
    const maxROI = validROIs.length > 0 ? d3.max(validROIs) : 0;
    
    // Ensure domain includes 0 if there are negative values, or if all values are zero
    // This ensures the zero line is visible when needed
    let yDomainMin, yDomainMax;
    if (minROI < 0) {
        // Has negative values: domain should include min and 0 (or max if max > 0)
        yDomainMin = minROI;
        yDomainMax = Math.max(0, maxROI);
    } else if (maxROI > 0) {
        // All positive: domain from 0 to max
        yDomainMin = 0;
        yDomainMax = maxROI;
    } else {
        // All zero or no valid data: use [0, 1] as fallback
        yDomainMin = 0;
        yDomainMax = 1;
    }
    
    // Ensure domain has a valid range (min < max)
    if (yDomainMin >= yDomainMax) {
        yDomainMax = yDomainMin + 1;
    }

    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([xAxisYPosition, 0]) // Use the adjusted x-axis position for proper alignment
        .nice();

    const xAxis = g.append('g')
        .attr('transform', `translate(0,${xAxisYPosition})`)
        .call(d3.axisBottom(xScale));
    
    // Style x-axis text (genre labels) - rotate and position correctly
    // Use selectAll to get all text elements and ensure they're visible
    xAxis.selectAll('text')
        .style('font-size', '11px')
        .style('fill', '#333')
        .style('opacity', 1)
        .attr('transform', 'rotate(-45)')
        .attr('dx', '-0.9em')
        .attr('dy', '0.5em')
        .attr('text-anchor', 'end')
        .style('font-weight', 'normal')
        .style('pointer-events', 'none');

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

    // Zero line: show if 0 is within the domain (which it always is based on our domain calculation)
    // Always show zero line when domain includes 0, which helps visualize ROI above/below break-even
    const hasNegativeROI = validROIs.some(roi => roi < 0);
    if (yDomainMin <= 0 && yDomainMax >= 0) {
        const zeroYPos = yScale(0);
        const zeroLine = g.append('line')
            .attr('x1', 0)
            .attr('y1', zeroYPos)
            .attr('x2', width)
            .attr('y2', zeroYPos)
            .attr('stroke', '#333')
            .attr('stroke-width', 1);
        
        // Make zero line solid if there are negative values, dashed otherwise
        if (!hasNegativeROI) {
            zeroLine.attr('stroke-dasharray', '3,3').attr('opacity', 0.5);
        }
    }

    const tooltip = d3.select('#tooltip');

    // Bars
    const bars = g.selectAll('.bar')
        .data(data);

    // Calculate zero line position on the y-axis
    const zeroY = yScale(0);

    const barsEnter = bars.enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.genre))
        .attr('width', xScale.bandwidth())
        .attr('fill', d => colorScale(d.genre));

    // Set initial positions for animation
    if (animate) {
        barsEnter
            .attr('y', d => {
                // Start from zero line
                return zeroY;
            })
            .attr('height', 0)
            .transition()
            .duration(800)
            .delay((d, i) => i * 50)
            .attr('y', d => {
                // For positive ROI: bar extends upward from zero line
                // For negative ROI: bar extends downward from zero line
                const roi = d.avgROI != null && !isNaN(d.avgROI) ? d.avgROI : 0;
                return roi >= 0 ? yScale(roi) : zeroY;
            })
            .attr('height', d => {
                const roi = d.avgROI != null && !isNaN(d.avgROI) ? d.avgROI : 0;
                return Math.abs(yScale(roi) - zeroY);
            });
    } else {
        barsEnter
            .attr('y', d => {
                const roi = d.avgROI != null && !isNaN(d.avgROI) ? d.avgROI : 0;
                return roi >= 0 ? yScale(roi) : zeroY;
            })
            .attr('height', d => {
                const roi = d.avgROI != null && !isNaN(d.avgROI) ? d.avgROI : 0;
                return Math.abs(yScale(roi) - zeroY);
            });
    }

    // Add interactions
    barsEnter
        .on('mouseover', function(event, d) {
            tooltip.style('opacity', '1');
            // Safely format ROI and profit values
            const roi = d.avgROI != null && !isNaN(d.avgROI) ? d.avgROI.toFixed(1) : 'N/A';
            const profit = d.avgProfit != null && !isNaN(d.avgProfit) ? (d.avgProfit / 1000000).toFixed(1) : 'N/A';
            tooltip.html(`<strong>${d.genre}</strong><br/>
                Avg ROI: ${roi}%<br/>
                Avg Profit: $${profit}M<br/>
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
    
    // Get computed styles to account for container padding
    const containerStyle = window.getComputedStyle(container);
    const containerPadding = {
        top: parseFloat(containerStyle.paddingTop) || 12,
        right: parseFloat(containerStyle.paddingRight) || 12,
        bottom: parseFloat(containerStyle.paddingBottom) || 12,
        left: parseFloat(containerStyle.paddingLeft) || 12
    };
    
    const margin = {top: 20, right: 20, bottom: 85, left: 60}; // Extra bottom margin for labels
    // Calculate available space within padded area
    const availableWidth = rect.width - containerPadding.left - containerPadding.right;
    const availableHeight = rect.height - containerPadding.top - containerPadding.bottom;
    const width = availableWidth - margin.left - margin.right;
    const height = availableHeight - margin.top - margin.bottom;

    // Set SVG dimensions to match container
    svg.attr('width', rect.width)
        .attr('height', rect.height)
        .style('overflow', 'visible');

    const g = svg.append('g')
        .attr('transform', `translate(${containerPadding.left + margin.left},${containerPadding.top + margin.top})`);

    // Check if there's no data
    if (filteredData.length === 0) {
        g.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '18px')
            .style('font-weight', 'bold')
            .style('fill', '#95a5a6')
            .style('opacity', 0)
            .text('No data available')
            .transition()
            .duration(animate ? 500 : 0)
            .style('opacity', 1);
        return;
    }

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
    const xAxis = g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale));
    
    // Style x-axis labels - ensure they're visible and positioned correctly
    xAxis.selectAll('text')
        .style('font-size', '13px')
        .style('fill', '#333')
        .style('font-weight', 'normal')
        .style('opacity', 1)
        .attr('dy', '1em')  // Position below axis line
        .attr('dx', 0)
        .style('text-anchor', 'middle')
        .style('pointer-events', 'none')
        .style('visibility', 'visible');
    
    // Style x-axis tick lines
    xAxis.selectAll('line')
        .style('stroke', '#ccc');
    
    // Style x-axis path
    xAxis.selectAll('path')
        .style('stroke', '#ccc');

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
    const successRate = filteredData.length > 0 ? (profitable / filteredData.length) * 100 : 0;

    // Safely format values, handling NaN and undefined
    const formatROI = (roi) => {
        if (roi != null && !isNaN(roi)) {
            return roi.toFixed(1) + '%';
        }
        return 'N/A';
    };
    
    const formatBudget = (budget) => {
        if (budget != null && !isNaN(budget)) {
            return '$' + (budget / 1000000).toFixed(1) + 'M';
        }
        return 'N/A';
    };
    
    const formatRate = (rate) => {
        if (rate != null && !isNaN(rate)) {
            return rate.toFixed(1) + '%';
        }
        return 'N/A';
    };

    document.getElementById('statsBox').innerHTML = 
        `<div class="stat">
            <div>Average ROI</div>
            <div class="stat-value">${formatROI(avgROI)}</div>
        </div>
        <div class="stat">
            <div>Avg Budget</div>
            <div class="stat-value">${formatBudget(avgBudget)}</div>
        </div>
        <div class="stat">
            <div>Success Rate</div>
            <div class="stat-value">${formatRate(successRate)}</div>
        </div>`;
}

function animateTimeline() {
    if (isAnimating) return;
    
    isAnimating = true;
    const btn = document.getElementById('animateBtn');
    btn.textContent = 'Stop Animation';
    btn.onclick = stopAnimation;
    
    // Get min and max years from data
    const years = rawData.map(d => d.releaseYear).filter(y => y !== null && y !== undefined);
    const minYear = d3.min(years);
    const maxYear = 2017; // Cap at 2017
    
    let currentYearStart = minYear;
    
    function animateYearRange() {
        if (!isAnimating || currentYearStart > maxYear) {
            stopAnimation();
            return;
        }
        
        // Calculate the interval (5 years, or less if near the end)
        let yearInterval = 5;
        const remainingYears = maxYear - currentYearStart;
        if (remainingYears < 5) {
            yearInterval = remainingYears + 1; // Include the max year
        }
        
        const currentYearEnd = Math.min(currentYearStart + yearInterval - 1, maxYear);
        
        // Update date sliders
        const minDateSlider = document.getElementById('minDate');
        const maxDateSlider = document.getElementById('maxDate');
        minDateSlider.value = currentYearStart;
        maxDateSlider.value = currentYearEnd;
        document.getElementById('minDateValue').textContent = currentYearStart;
        document.getElementById('maxDateValue').textContent = currentYearEnd;
        
        // Filter data for current year range (using the same filter logic as updateVisualizations)
        const genreFilter = document.getElementById('genreFilter').value;
        const languageFilter = document.getElementById('languageFilter').value;
        const minBudget = parseFloat(document.getElementById('minBudget').value);
        const maxBudget = parseFloat(document.getElementById('maxBudget').value);
        
        filteredData = rawData.filter(d => {
            const genreMatch = genreFilter === 'all' || d.genreList.includes(genreFilter) || 
                             (selectedGenre && d.mainGenre === selectedGenre);
            const languageMatch = languageFilter === 'all' || d.language === languageFilter;
            const budgetMatch = d.budget >= minBudget && d.budget <= maxBudget;
            const dateMatch = d.releaseYear && d.releaseYear >= currentYearStart && d.releaseYear <= currentYearEnd;
            return genreMatch && languageMatch && budgetMatch && dateMatch;
        });
        
        // Apply sample size filter
        const sampleSlider = document.getElementById('sampleSize');
        if (sampleSlider && filteredData.length > 0) {
            const sampleSize = Math.min(parseInt(sampleSlider.value), filteredData.length);
            if (sampleSize < filteredData.length) {
                const sampled = [...filteredData];
                for (let i = sampled.length - 1; i > sampled.length - sampleSize - 1; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [sampled[i], sampled[j]] = [sampled[j], sampled[i]];
                }
                filteredData = sampled.slice(-sampleSize);
            }
        }
        
        // Update visualizations with smooth transition
        if (filteredData.length > 0) {
            updateScatterPlot(true);
            updateGenreChart(true);
            updateProfitChart(true);
        }
        
        currentYearStart += 5;
        setTimeout(animateYearRange, 2500); // 2.5 seconds per interval
    }
    
    animateYearRange();
}

function stopAnimation() {
    isAnimating = false;
    const btn = document.getElementById('animateBtn');
    btn.textContent = 'Play Timeline';
    btn.onclick = animateTimeline;
    
    // Reset ALL filters and sliders to initial state
    
    // Reset genre filter
    document.getElementById('genreFilter').value = 'all';
    selectedGenre = null;
    
    // Hide genre color indicator
    const genreColorIndicator = document.getElementById('genreColorIndicator');
    if (genreColorIndicator) {
        genreColorIndicator.style.display = 'none';
    }
    
    // Reset language filter
    document.getElementById('languageFilter').value = 'all';
    
    // Reset budget sliders
    const maxBudgetFromData = rawData.length > 0 ? d3.max(rawData, d => d.budget) : 300000000;
    document.getElementById('minBudget').value = MIN_SLIDER_BUDGET;
    document.getElementById('minBudgetValue').textContent = '0.1M';
    document.getElementById('maxBudget').value = maxBudgetFromData;
    document.getElementById('maxBudgetValue').textContent = (maxBudgetFromData / 1000000).toFixed(0) + 'M';
    
    // Reset date sliders to show all years
    const years = rawData.map(d => d.releaseYear).filter(y => y !== null && y !== undefined);
    const minYear = years.length > 0 ? d3.min(years) : 1900;
    const maxYear = years.length > 0 ? d3.max(years) : 2025;
    document.getElementById('minDate').value = minYear;
    document.getElementById('maxDate').value = maxYear;
    document.getElementById('minDateValue').textContent = minYear;
    document.getElementById('maxDateValue').textContent = maxYear;
    
    // Reset sample size to max (show all data)
    const sampleSlider = document.getElementById('sampleSize');
    const sampleValue = document.getElementById('sampleSizeValue');
    if (sampleSlider && sampleValue) {
        sampleSlider.max = rawData.length;
        sampleSlider.value = rawData.length;
        sampleValue.textContent = rawData.length;
    }
    
    // Clear any genre highlights
    d3.selectAll('.bar').classed('selected', false);
    d3.selectAll('.dot')
        .classed('highlighted', false)
        .classed('dimmed', false);
    
    // Reset zoom
    const svg = d3.select('#scatterPlot');
    lastValidTransform = d3.zoomIdentity;
    if (zoom) {
        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity);
    }
    
    // Update all visualizations with the reset state
    updateVisualizations(true);
}

// Auto-load cleaned.csv when data visualization is shown
function autoLoadData() {
    const dataViz = document.getElementById('dataVisualization');
    if (!dataViz || dataViz.style.display === 'none') {
        return; // Don't load if not visible
    }
    
    // Prevent duplicate loads
    if (dataLoaded || dataLoading) {
        return;
    }
    
    dataLoading = true;
    
    fetch('cleaned.csv?t=' + Date.now())
        .then(response => {
            if (!response.ok) throw new Error('No cleaned.csv found');
            return response.text();
        })
        .then(csvText => {
            try {
                Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: function(results) {
                        try {
                            processData(results.data);
                            dataLoaded = true;
                            dataLoading = false;
                        } catch (err) {
                            console.error('Error processing data:', err);
                            dataLoading = false;
                        }
                    },
                    error: function(err) {
                        console.error('Error parsing CSV:', err);
                        dataLoading = false;
                        if (!dataLoaded) {
                            console.log('cleaned.csv could not be parsed.');
                        }
                    }
                });
            } catch (err) {
                console.error('Error in Papa.parse:', err);
                dataLoading = false;
                if (!dataLoaded) {
                    console.log('cleaned.csv parsing failed.');
                }
            }
        })
        .catch(err => {
            dataLoading = false;
            // Only log error if we haven't successfully loaded data before
            // (Data might already be loaded from a previous successful call)
            if (!dataLoaded && rawData.length === 0) {
                console.log('cleaned.csv not found, waiting for manual upload.');
            }
        });
}

// Expose autoLoadData globally so frontpage.js can call it
window.autoLoadData = autoLoadData;

