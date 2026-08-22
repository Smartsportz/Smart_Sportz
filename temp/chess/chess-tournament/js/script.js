// Data for the chess tournament
const schools = [
    {
        school: "Chennai Public School",
        players: [
            {
                name: "Arjun Kumar",
                rank: 1,
                photo: "images/player1.jpg",
                matchesWon: 15
            },
            {
                name: "Rahul Sharma",
                rank: 2,
                photo: "images/player2.jpg",
                matchesWon: 12
            }
        ]
    },
    {
        school: "ABC Matriculation Higher Secondary School",
        players: [
            {
                name: "Priya Rajan",
                rank: 1,
                photo: "images/player3.jpg",
                matchesWon: 18
            },
            {
                name: "Sanjay Singh",
                rank: 2,
                photo: "images/player4.jpg",
                matchesWon: 14
            }
        ]
    },
    {
        school: "St. Mary's Higher Secondary School",
        players: [
            {
                name: "Karthik Iyer",
                rank: 1,
                photo: "images/player5.jpg",
                matchesWon: 20
            },
            {
                name: "Neha Gupta",
                rank: 2,
                photo: "images/player6.jpg",
                matchesWon: 16
            }
        ]
    },
    {
        school: "Government Higher Secondary School",
        players: [
            {
                name: "Vijay Sethupathi",
                rank: 1,
                photo: "images/player7.jpg",
                matchesWon: 22
            },
            {
                name: "Lakshmi Menon",
                rank: 2,
                photo: "images/player8.jpg",
                matchesWon: 19
            }
        ]
    },
    {
        school: "National Public School",
        players: [
            {
                name: "Aditya Verma",
                rank: 1,
                photo: "images/player9.jpg",
                matchesWon: 17
            },
            {
                name: "Meera Reddy",
                rank: 2,
                photo: "images/player10.jpg",
                matchesWon: 13
            }
        ]
    }
];

// Initialize page functionality based on the current page
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the school selection page
    const schoolSelect = document.getElementById('school-select');
    
    if (schoolSelect) {
        populateSchoolDropdown();
        
        // Add event listener for dropdown change
        schoolSelect.addEventListener('change', (e) => {
            const selectedSchoolName = e.target.value;
            displayPlayers(selectedSchoolName);
        });
    }
});

/**
 * Populates the school dropdown with data from the schools array
 */
function populateSchoolDropdown() {
    const select = document.getElementById('school-select');
    
    schools.forEach(schoolData => {
        const option = document.createElement('option');
        option.value = schoolData.school;
        option.textContent = schoolData.school;
        select.appendChild(option);
    });
}

/**
 * Displays the top two players for the selected school
 * @param {string} schoolName - The name of the selected school
 */
function displayPlayers(schoolName) {
    const resultsSection = document.getElementById('results-section');
    const emptyState = document.getElementById('empty-state');
    const playerCardsContainer = document.getElementById('player-cards');
    
    // Find the school data
    const schoolData = schools.find(s => s.school === schoolName);
    
    if (schoolData) {
        // Clear previous cards
        playerCardsContainer.innerHTML = '';
        
        // Hide empty state, show results
        emptyState.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        
        // Generate and append cards for the two players
        schoolData.players.forEach(player => {
            const card = document.createElement('div');
            card.className = 'player-card';
            
            // Note: If image fails to load, we use a placeholder styling via CSS background and SVG fallback
            card.innerHTML = `
                <img src="${player.photo}" alt="${player.name}" class="player-photo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'250\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23E2F0D9\\'/><text x=\\'50%\\' y=\\'50%\\' font-family=\\'Arial\\' font-size=\\'18\\' fill=\\'%235F7F67\\' text-anchor=\\'middle\\' dominant-baseline=\\'middle\\'>Photo Unavailable</text></svg>'">
                <div class="player-info">
                    <div class="player-rank">#${player.rank}</div>
                    <h3 class="player-name">${player.name}</h3>
                    <p class="player-school">
                        <span>♔</span> ${schoolName}
                    </p>
                    <button class="btn-about" onclick="togglePlayerStats(this)">About Player</button>
                    <div class="player-stats hidden">
                        <div class="stat-box">
                            <span class="stat-number">${player.matchesWon}</span>
                            <span class="stat-label">Matches Won</span>
                        </div>
                    </div>
                </div>
            `;
            
            playerCardsContainer.appendChild(card);
        });
    }
}


/**
 * Toggles the visibility of player statistics
 * @param {HTMLElement} btn - The clicked button element
 */
window.togglePlayerStats = function(btn) {
    const statsDiv = btn.nextElementSibling;
    if (statsDiv.classList.contains('hidden')) {
        statsDiv.classList.remove('hidden');
        btn.textContent = 'Hide Info';
    } else {
        statsDiv.classList.add('hidden');
        btn.textContent = 'About Player';
    }
}
