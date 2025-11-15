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
    
    // Only initialize if we're on the home route
    if (window.location.pathname !== '/' && window.location.pathname !== '') {
        return;
    }
    
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
    // Navigate to /data route
    window.history.pushState({ page: 'data' }, 'Data Visualization', '/data');
    updateView();
}

function showFrontpage() {
    // Navigate to / route
    window.history.pushState({ page: 'home' }, 'Home', '/');
    updateView();
}

function updateView() {
    const path = window.location.pathname;
    const frontpage = document.getElementById('frontpage');
    const dataViz = document.getElementById('dataVisualization');
    
    if (path === '/data') {
        // Show data visualization
        if (frontpage) {
            frontpage.style.display = 'none';
        }
        
        if (dataViz) {
            dataViz.style.display = 'block';
            // Wait a moment for layout, then load data
            setTimeout(() => {
                if (window.autoLoadData) {
                    window.autoLoadData();
                }
            }, 100);
        }
    } else {
        // Show frontpage
        if (dataViz) {
            dataViz.style.display = 'none';
        }
        
        if (frontpage) {
            frontpage.style.display = 'flex';
            // Restart animation if needed
            if (!frontpage.querySelector('.button-container.show')) {
                startAnimation();
            }
        }
    }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', updateView);

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    // Check current route and show appropriate view
    updateView();
    
    // If on home page, initialize frontpage
    if (window.location.pathname === '/' || window.location.pathname === '') {
        initializeFrontpage();
    }
    
    // Handle back button click
    const backBtn = document.getElementById('backToHome');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showFrontpage();
        });
    }
});

