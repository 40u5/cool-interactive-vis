// Frontpage animation and navigation
let animationTimeouts = [];

function initializeFrontpage() {
    const frontpage = document.getElementById('frontpage');
    const dataViz = document.getElementById('dataVisualization');
    
    // Error check
    if (!frontpage || !dataViz) {
        console.error('Required elements not found');
        if (dataViz) dataViz.style.display = 'block';
        return;
    }
    
    // Show frontpage, hide data viz
    frontpage.style.display = 'flex';
    dataViz.style.display = 'none';
    
    // Start animation sequence
    startAnimation();
    
    // Attach button listeners
    const skipBtn = document.getElementById('skipBtn');
    
    if (skipBtn) {
        skipBtn.addEventListener('click', showDataVisualization);
    }
    
    // Press any key or click to skip animation (show buttons)
    document.addEventListener('keydown', skipAnimation, { once: true });
}

function startAnimation() {
    const text1 = document.getElementById('text1');
    const text2 = document.getElementById('text2');
    const text3 = document.getElementById('text3');
    const buttons = document.getElementById('frontpageButtons');
    
    // Animate text sequence
    if (text1) {
        animationTimeouts.push(setTimeout(() => {
            text1.classList.add('show');
        }, 200));
    }
    
    if (text2) {
        animationTimeouts.push(setTimeout(() => {
            text2.classList.add('show');
        }, 1200));
    }
    
    if (text3) {
        animationTimeouts.push(setTimeout(() => {
            text3.classList.add('show');
        }, 2200));
    }
    
    // Show buttons after text animation
    if (buttons) {
        animationTimeouts.push(setTimeout(() => {
            buttons.classList.add('show');
        }, 3700));
    }
}

function skipAnimation() {
    // Clear all timeouts
    animationTimeouts.forEach(timeout => clearTimeout(timeout));
    animationTimeouts = [];
    
    // Show all text and buttons immediately
    const texts = document.querySelectorAll('.animate-text');
    const buttons = document.getElementById('frontpageButtons');
    
    texts.forEach(text => text.classList.add('show'));
    if (buttons) buttons.classList.add('show');
}

function showDataVisualization() {
    // Use hash-based routing to avoid server configuration issues
    window.location.hash = '#/data';
    updateView();
}

function updateView() {
    // Use hash-based routing instead of pathname to avoid 404 errors
    const hash = window.location.hash;
    const path = hash === '' ? '/' : hash;
    const frontpage = document.getElementById('frontpage');
    const dataViz = document.getElementById('dataVisualization');
    
    // Check if path is /data or contains /data
    if (path === '#/data' || path.includes('/data')) {
        // Show data page
        if (frontpage) frontpage.style.display = 'none';
        if (dataViz) {
            dataViz.style.display = 'block';
            setTimeout(() => {
                if (window.autoLoadData) window.autoLoadData();
            }, 100);
        }
    } else {
        // Show main page
        if (dataViz) dataViz.style.display = 'none';
        if (frontpage) {
            frontpage.style.display = 'flex';
            if (!frontpage.querySelector('.button-container.show')) {
                startAnimation();
            }
        }
    }
}

// Handle browser back/forward with hash changes
window.addEventListener('hashchange', updateView);

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    // If there's no hash and we're at root, set default hash
    if (!window.location.hash && (window.location.pathname === '/' || window.location.pathname === '')) {
        window.location.hash = '#/';
    }
    
    // First update the view based on current hash/path
    updateView();
    
    // Only initialize frontpage animation if we're on the home page
    const hash = window.location.hash;
    const path = hash === '' ? '/' : hash;
    if (path === '/' || path === '#/' || (!path.includes('/data'))) {
        // Only start animation if frontpage is visible and hasn't been animated yet
        const frontpage = document.getElementById('frontpage');
        if (frontpage && frontpage.style.display !== 'none') {
            initializeFrontpage();
        }
    }
});

