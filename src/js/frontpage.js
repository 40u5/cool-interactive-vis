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
    const playBtn = document.getElementById('playGameBtn');
    const skipBtn = document.getElementById('skipBtn');
    
    if (skipBtn) {
        skipBtn.addEventListener('click', showDataVisualization);
    }
    
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            alert('Game coming soon! For now, showing data visualization.');
            showDataVisualization();
        });
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
    const frontpage = document.getElementById('frontpage');
    const dataViz = document.getElementById('dataVisualization');
    
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
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', initializeFrontpage);

