// Quiz logic
let quizData = [];
let moviesByCategory = {
    'blockbuster': [],
    'pretty-good': [],
    'broke-even': [],
    'failed': [],
    'dumpster': []
};
let currentMovie = null;
let quizScore = {
    correct: 0,
    total: 0
};

// Load movie data
function loadQuizData() {
    fetch('cleaned.csv?t=' + Date.now())
        .then(response => response.text())
        .then(csvText => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    // Filter movies with valid data and categorize them
                    // Exclude movies with budget of 0 or invalid data
                    quizData = results.data.filter(d => {
                        const budget = parseFloat(d.budget);
                        const revenue = parseFloat(d.revenue);
                        const poster = d.poster_path;
                        return !isNaN(budget) && !isNaN(revenue) && 
                               budget > 0 && revenue > 0 && 
                               poster && poster.length > 0 &&
                               budget !== 0; // Explicitly exclude budget of 0
                    });
                    
                    // Categorize movies by profit percentage
                    moviesByCategory = {
                        'blockbuster': [],
                        'pretty-good': [],
                        'broke-even': [],
                        'failed': [],
                        'dumpster': []
                    };
                    
                    quizData.forEach(movie => {
                        const budget = parseFloat(movie.budget);
                        const revenue = parseFloat(movie.revenue);
                        const category = getMovieCategory(budget, revenue);
                        moviesByCategory[category].push(movie);
                    });
                    
                    console.log('Loaded', quizData.length, 'quiz-ready movies');
                    console.log('Category distribution:', {
                        blockbuster: moviesByCategory.blockbuster.length,
                        'pretty-good': moviesByCategory['pretty-good'].length,
                        'broke-even': moviesByCategory['broke-even'].length,
                        failed: moviesByCategory.failed.length,
                        dumpster: moviesByCategory.dumpster.length
                    });
                    
                    loadNextQuestion();
                }
            });
        })
        .catch(err => {
            console.error('Error loading quiz data:', err);
        });
}

// Determine movie category based on profit percentage
function getMovieCategory(budget, revenue) {
    const profit = revenue - budget;
    const profitPercentage = (profit / budget) * 100;
    
    if (profitPercentage > 30) {
        return 'blockbuster';
    } else if (profitPercentage > 10) {
        return 'pretty-good';
    } else if (profitPercentage >= 0) {
        return 'broke-even';
    } else if (profitPercentage > -10) {
        return 'failed';
    } else {
        return 'dumpster';
    }
}

// Get random movie from a random category
function getRandomMovie() {
    // Get all categories that have movies
    const availableCategories = Object.keys(moviesByCategory).filter(
        cat => moviesByCategory[cat].length > 0
    );
    
    if (availableCategories.length === 0) return null;
    
    // Randomly select a category
    const randomCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];
    
    // Randomly select a movie from that category
    const moviesInCategory = moviesByCategory[randomCategory];
    const randomIndex = Math.floor(Math.random() * moviesInCategory.length);
    
    return moviesInCategory[randomIndex];
}

// Load next question
function loadNextQuestion() {
    currentMovie = getRandomMovie();
    if (!currentMovie) {
        console.error('No movies available for quiz');
        return;
    }
    
    // Display movie
    const posterUrl = `https://image.tmdb.org/t/p/w500${currentMovie.poster_path}`;
    const budgetM = (parseFloat(currentMovie.budget) / 1000000).toFixed(1);
    
    document.getElementById('moviePoster').src = posterUrl;
    document.getElementById('movieTitle').textContent = currentMovie.title || 'Unknown Title';
    document.getElementById('movieDate').textContent = currentMovie.release_date || 'Release date unknown';
    document.getElementById('movieBudget').textContent = `Budget: $${budgetM}M`;
    
    // Reset buttons
    const buttons = document.querySelectorAll('.quiz-option');
    buttons.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('correct', 'incorrect');
    });
    
    // Hide result container
    document.getElementById('resultContainer').style.display = 'none';
    document.getElementById('quizButtons').style.display = 'grid';
}

// Check answer
function checkAnswer(userAnswer) {
    const budget = parseFloat(currentMovie.budget);
    const revenue = parseFloat(currentMovie.revenue);
    const correctAnswer = getMovieCategory(budget, revenue);
    const profit = revenue - budget;
    
    const isCorrect = userAnswer === correctAnswer;
    
    // Update score
    quizScore.total++;
    if (isCorrect) {
        quizScore.correct++;
    }
    document.getElementById('quizScore').textContent = `${quizScore.correct}/${quizScore.total}`;
    
    // Disable all buttons
    const buttons = document.querySelectorAll('.quiz-option');
    buttons.forEach(btn => {
        btn.disabled = true;
        const btnAnswer = btn.getAttribute('data-answer');
        if (btnAnswer === correctAnswer) {
            btn.classList.add('correct');
        }
        if (btnAnswer === userAnswer && !isCorrect) {
            btn.classList.add('incorrect');
        }
    });
    
    // Show result
    setTimeout(() => {
        const resultMessage = document.getElementById('resultMessage');
        const resultDetails = document.getElementById('resultDetails');
        
        if (isCorrect) {
            resultMessage.innerHTML = '🎉 Correct!';
            resultMessage.style.color = '#2ecc71';
        } else {
            resultMessage.innerHTML = '❌ Not quite!';
            resultMessage.style.color = '#e74c3c';
        }
        
        // Show movie financials
        const budgetM = (budget / 1000000).toFixed(1);
        const revenueM = (revenue / 1000000).toFixed(1);
        const profitM = (profit / 1000000).toFixed(1);
        
        // Calculate profit percentage
        const profitPercentage = (profit / budget) * 100;
        
        let categoryText = '';
        if (correctAnswer === 'blockbuster') {
            categoryText = '🚀 Blockbuster';
        } else if (correctAnswer === 'pretty-good') {
            categoryText = '😊 Pretty Good';
        } else if (correctAnswer === 'broke-even') {
            categoryText = '📊 Basically Broke Even';
        } else if (correctAnswer === 'failed') {
            categoryText = '😬 Failed Investment';
        } else {
            categoryText = '💸 Money Dumpster';
        }
        
        resultDetails.innerHTML = `
            <strong>${currentMovie.title}</strong> was a <strong>${categoryText}</strong><br/>
            Budget: $${budgetM}M<br/>
            Revenue: $${revenueM}M<br/>
            Profit: ${profit > 0 ? '+' : ''}$${profitM}M (${profitPercentage > 0 ? '+' : ''}${profitPercentage.toFixed(1)}%)
        `;
        
        document.getElementById('quizButtons').style.display = 'none';
        document.getElementById('resultContainer').style.display = 'block';
    }, 800);
}

// Initialize quiz when page is shown
function initializeQuiz() {
    console.log('Initializing quiz...');
    
    // Reset score on fresh initialization
    quizScore = {
        correct: 0,
        total: 0
    };
    document.getElementById('quizScore').textContent = '0/0';
    
    // Load data if not already loaded
    if (quizData.length === 0) {
        loadQuizData();
    } else {
        loadNextQuestion();
    }
    
    // Add event listeners to quiz buttons
    document.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', function() {
            const answer = this.getAttribute('data-answer');
            checkAnswer(answer);
        });
    });
    
    // Next button
    document.getElementById('nextBtn').addEventListener('click', () => {
        loadNextQuestion();
    });
    
    // Back button
    document.getElementById('backToHomeBtn').addEventListener('click', () => {
        window.location.hash = '#/';
    });
}

// Export to global scope
window.initializeQuiz = initializeQuiz;

// Auto-initialize when DOM is ready (if quiz is already visible)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('quizPage').style.display !== 'none') {
            initializeQuiz();
        }
    });
} else {
    if (document.getElementById('quizPage').style.display !== 'none') {
        initializeQuiz();
    }
}

