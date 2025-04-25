document.addEventListener('DOMContentLoaded', () => {
    const leaderboardLink = document.getElementById('leaderboard-link');
    const leaderboardOverlay = document.getElementById('leaderboard-overlay');
    const closeLeaderboard = document.getElementById('close-leaderboard');
    const leaderboardTabs = document.querySelectorAll('.leaderboard-tab');
    const leaderboardContent = document.getElementById('leaderboard-content');

    // Function to show leaderboard overlay
    function showLeaderboard() {
        leaderboardOverlay.classList.remove('hidden');
        // Fetch initial data
        fetchLeaderboard('posts');
    }

    // Function to hide leaderboard overlay
    function hideLeaderboard() {
        leaderboardOverlay.classList.add('hidden');
    }

    // Function to fetch leaderboard data
    async function fetchLeaderboard(type) {
        try {
            const response = await fetch(`/api/leaderboard?type=${type}`);
            if (!response.ok) {
                throw new Error('Failed to fetch leaderboard data');
            }
            const data = await response.json();
            displayLeaderboard(data);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            leaderboardContent.innerHTML = '<div class="error">Failed to load leaderboard data</div>';
        }
    }

    // Function to display leaderboard data
    function displayLeaderboard(data) {
        if (!data || data.length === 0) {
            leaderboardContent.innerHTML = '<div class="error">No data available</div>';
            return;
        }

        const html = data.map((item, index) => `
            <div class="leaderboard-item">
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-user">
                    <div class="user-name">${item.user.name}</div>
                    <div class="user-email">${item.user.email}</div>
                </div>
                <div class="leaderboard-score">${item.score}</div>
            </div>
        `).join('');

        leaderboardContent.innerHTML = html;
    }

    // Event listeners
    leaderboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        showLeaderboard();
    });

    closeLeaderboard.addEventListener('click', hideLeaderboard);

    leaderboardTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            leaderboardTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Fetch data for selected type
            const type = tab.dataset.tab;
            fetchLeaderboard(type);
        });
    });

    // Close overlay when clicking outside
    leaderboardOverlay.addEventListener('click', (e) => {
        if (e.target === leaderboardOverlay) {
            hideLeaderboard();
        }
    });
}); 