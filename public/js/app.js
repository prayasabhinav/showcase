document.addEventListener('DOMContentLoaded', function() {
    // Check login status when page loads
    fetchUserStatus();
    
    // Handle type selection change
    const typeSelect = document.getElementById('type');
    const urlGroup = document.getElementById('url-group');
    const titleGroup = document.getElementById('title-group');
    const descriptionGroup = document.getElementById('description-group');
    
    if (typeSelect) {
        typeSelect.addEventListener('change', function() {
            if (this.value === 'project') {
                // Show title field, hide description field
                titleGroup.classList.remove('hidden');
                descriptionGroup.classList.add('hidden');
                document.getElementById('title').required = true;
                document.getElementById('description').required = false;
                
                // Update URL field
                urlGroup.querySelector('label').textContent = 'URL:';
                urlGroup.querySelector('input').required = true;
                urlGroup.style.display = 'block';
            } else if (this.value === 'idea') {
                // Show description field, hide title field
                titleGroup.classList.add('hidden');
                descriptionGroup.classList.remove('hidden');
                document.getElementById('title').required = false;
                document.getElementById('description').required = true;
                
                // Update URL field
                urlGroup.querySelector('label').textContent = 'Reference URL (optional):';
                urlGroup.querySelector('input').required = false;
                urlGroup.style.display = 'block';
            } else {
                // Neither selected
                urlGroup.style.display = 'none';
            }
        });
    }
    
    // Handle form submission
    const submissionForm = document.getElementById('submission-form');
    if (submissionForm) {
        submissionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitItem();
        });
    }
    
    // Handle filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Apply filter
            filterItems(filter);
        });
    });

    // Handle overlay controls
    const addItemBtn = document.getElementById('add-item-btn');
    const submissionOverlay = document.getElementById('submission-overlay');
    const closeOverlayBtn = document.getElementById('close-overlay');
    
    addItemBtn.addEventListener('click', function() {
        submissionOverlay.classList.remove('hidden');
    });
    
    closeOverlayBtn.addEventListener('click', function() {
        submissionOverlay.classList.add('hidden');
    });
    
    // Close overlay when clicking outside the content
    submissionOverlay.addEventListener('click', function(e) {
        if (e.target === submissionOverlay) {
            submissionOverlay.classList.add('hidden');
        }
    });
});

// Fetch user login status
function fetchUserStatus() {
    fetch('/api/user')
        .then(response => response.json())
        .then(data => {
            if (data.authenticated) {
                // User is logged in
                document.getElementById('login-btn').classList.add('hidden');
                document.getElementById('user-info').classList.remove('hidden');
                document.getElementById('user-name').textContent = data.user.name;
                document.getElementById('content-area').classList.remove('hidden');
                document.getElementById('user-stats').classList.remove('hidden');
                
                // Show admin controls if the user is prayas.abhinav@anu.edu.in
                const adminControls = document.getElementById('admin-controls');
                if (data.user.email === 'prayas.abhinav@anu.edu.in') {
                    adminControls.classList.remove('hidden');
                } else {
                    adminControls.classList.add('hidden');
                }
                
                // Load items and user stats
                fetchItems();
                fetchUserStats();
            } else {
                // User is not logged in
                document.getElementById('login-btn').classList.remove('hidden');
                document.getElementById('user-info').classList.add('hidden');
                document.getElementById('content-area').classList.add('hidden');
                document.getElementById('user-stats').classList.add('hidden');
            }
        })
        .catch(error => console.error('Error fetching user status:', error));
}

// Fetch user stats
function fetchUserStats() {
    console.log('\n=== Starting User Stats Fetch ===');
    console.log('Fetching user stats from server...');
    
    fetch('/api/user/stats')
        .then(response => {
            console.log('Stats response status:', response.status);
            if (!response.ok) {
                return response.json().then(err => {
                    console.error('Stats error response:', err);
                    throw new Error(err.error || 'Failed to fetch user stats');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('\nReceived raw stats data:', data);
            if (!data) {
                throw new Error('No data received from server');
            }
            
            // Update the UI with the stats
            const monthProjectsElement = document.getElementById('month-projects');
            const weekIdeasElement = document.getElementById('week-ideas');
            const streakPointsElement = document.getElementById('streak-points');
            
            if (monthProjectsElement) {
                // Parse the value as a number and ensure it's not undefined or null
                const monthProjects = parseInt(data.currentMonthProjects) || 0;
                console.log('\nProcessing month projects:');
                console.log('Raw value:', data.currentMonthProjects);
                console.log('Parsed value:', monthProjects);
                console.log('Setting element text to:', monthProjects);
                monthProjectsElement.textContent = monthProjects;
                monthProjectsElement.style.display = 'block';
            }
            
            if (weekIdeasElement) {
                // Parse the value as a number and ensure it's not undefined or null
                const weekIdeas = parseInt(data.currentWeekIdeas) || 0;
                console.log('\nProcessing week ideas:');
                console.log('Raw value:', data.currentWeekIdeas);
                console.log('Parsed value:', weekIdeas);
                console.log('Setting element text to:', weekIdeas);
                weekIdeasElement.textContent = weekIdeas;
                weekIdeasElement.style.display = 'block';
            }
            
            if (streakPointsElement) {
                // Parse the value as a number and ensure it's not undefined or null
                const streakPoints = parseInt(data.streakPoints) || 0;
                console.log('\nProcessing streak points:');
                console.log('Raw value:', data.streakPoints);
                console.log('Parsed value:', streakPoints);
                console.log('Setting element text to:', streakPoints);
                streakPointsElement.textContent = streakPoints;
                streakPointsElement.style.display = 'block';
            }
            
            console.log('\n=== End User Stats Fetch ===\n');
        })
        .catch(error => {
            console.error('\nError fetching user stats:', error);
            // Set all values to 0 in case of error
            const monthProjectsElement = document.getElementById('month-projects');
            const weekIdeasElement = document.getElementById('week-ideas');
            const streakPointsElement = document.getElementById('streak-points');
            
            if (monthProjectsElement) {
                console.log('Setting month projects to 0 due to error');
                monthProjectsElement.textContent = '0';
                monthProjectsElement.style.display = 'block';
            }
            
            if (weekIdeasElement) {
                console.log('Setting week ideas to 0 due to error');
                weekIdeasElement.textContent = '0';
                weekIdeasElement.style.display = 'block';
            }
            
            if (streakPointsElement) {
                console.log('Setting streak points to 0 due to error');
                streakPointsElement.textContent = '0';
                streakPointsElement.style.display = 'block';
            }
            
            console.log('\n=== End User Stats Fetch (Error Case) ===\n');
        });
}

// Submit a new item (project or idea)
function submitItem() {
    const form = document.getElementById('submission-form');
    const formData = new FormData(form);
    const type = formData.get('type');
    
    // Get the appropriate content based on type
    let title = '';
    if (type === 'project') {
        title = formData.get('title');
    } else if (type === 'idea') {
        title = formData.get('description');
    }
    
    console.log('Submitting item:', { type, title });
    
    // Validate required fields
    if (!title || !type) {
        alert('Please fill in all required fields');
        return;
    }

    // Clean up keywords
    const keywords = formData.get('keywords')
        .split(',')
        .map(keyword => keyword.trim())
        .filter(keyword => keyword.length > 0);

    if (keywords.length === 0) {
        alert('Please add at least one keyword');
        return;
    }
    
    const itemData = {
        type: type,
        title: title,
        url: formData.get('url') || '',
        keywords: keywords
    };
    
    console.log('Sending item data:', itemData);
    
    fetch('/api/items', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemData)
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
            return response.json().then(err => {
                console.error('Server error:', err);
                throw new Error(err.error || 'Failed to create item');
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Item created successfully:', data);
        form.reset();
        // Reset the form display
        const titleGroup = document.getElementById('title-group');
        const descriptionGroup = document.getElementById('description-group');
        titleGroup.classList.remove('hidden');
        descriptionGroup.classList.add('hidden');
        // Close the overlay
        document.getElementById('submission-overlay').classList.add('hidden');
        // Refresh items and user stats
        fetchItems();
        fetchUserStats();
        alert('Your submission was successful!');
    })
    .catch(error => {
        console.error('Error submitting item:', error);
        alert(error.message || 'An error occurred. Please try again.');
    });
}

// Fetch all items from the server
function fetchItems() {
    fetch('/api/items')
        .then(response => response.json())
        .then(items => {
            displayItems(items);
        })
        .catch(error => console.error('Error fetching items:', error));
}

// Display items in the container
function displayItems(items) {
    const container = document.getElementById('items-container');
    const template = document.getElementById('item-template');
    
    // Clear container
    container.innerHTML = '';
    
    // Sort items by upvote count (descending)
    items.sort((a, b) => b.upvotes - a.upvotes);
    
    items.forEach(item => {
        // Clone template
        const itemElement = template.content.cloneNode(true);
        const wrapper = itemElement.querySelector('.item-wrapper');
        const card = itemElement.querySelector('.item-card');
        
        // Set data type attribute for styling and filtering
        card.setAttribute('data-type', item.type);
        
        // Fill in content
        card.querySelector('.item-title').textContent = item.title;
        
        // Add author name
        const authorElement = card.querySelector('.item-author');
        if (item.createdBy && item.createdBy.name) {
            authorElement.textContent = `Posted by: ${item.createdBy.name}`;
            authorElement.style.display = 'block';
        } else {
            authorElement.style.display = 'none';
        }
        
        // Handle URL display
        const urlElement = card.querySelector('.item-url');
        if (item.url) {
            urlElement.querySelector('a').href = item.url;
            urlElement.querySelector('a').textContent = item.type === 'project' ? 'View Project' : 'Reference Link';
            urlElement.style.display = 'block';
        } else {
            urlElement.style.display = 'none';
        }
        
        // Set upvote count
        card.querySelector('.upvote-count').textContent = item.upvotes;
        
        // Add upvote functionality
        card.querySelector('.upvote-btn').addEventListener('click', function() {
            upvoteItem(item._id, card);
        });
        
        // Add keywords at the bottom
        const keywordsContainer = card.querySelector('.item-keywords');
        keywordsContainer.innerHTML = ''; // Clear existing keywords
        item.keywords.forEach(keyword => {
            const keywordSpan = document.createElement('span');
            keywordSpan.className = 'keyword';
            keywordSpan.textContent = keyword;
            keywordsContainer.appendChild(keywordSpan);
        });
        
        // Add delete link for admin or item owner
        const deleteLink = wrapper.querySelector('.delete-link');
        deleteLink.style.display = 'none'; // Hidden by default
        
        // Check if user is admin or the owner of the item
        fetch('/api/user')
            .then(response => response.json())
            .then(data => {
                console.log('Checking delete permissions:', {
                    isAuthenticated: data.authenticated,
                    userEmail: data.user?.email,
                    isAdmin: data.user?.email === 'prayas.abhinav@anu.edu.in',
                    itemCreatorId: item.createdBy?._id,
                    currentUserId: data.user?._id
                });
                
                if (data.authenticated) {
                    // Show delete button for admin or item owner
                    if (data.user.email === 'prayas.abhinav@anu.edu.in' || 
                        (item.createdBy && item.createdBy._id === data.user._id)) {
                        console.log('Showing delete button for item:', item._id);
                        deleteLink.style.display = 'block';
                        // Add admin indicator if user is admin
                        if (data.user.email === 'prayas.abhinav@anu.edu.in') {
                            deleteLink.textContent = 'Delete (Admin)';
                        }
                    } else {
                        console.log('Hiding delete button for item:', item._id);
                    }
                }
            });
        
        deleteLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to delete this item?')) {
                deleteItem(item._id, wrapper);
            }
        });
        
        // Add item to container
        container.appendChild(itemElement);
    });

    // Apply current filter after loading items
    const activeFilter = document.querySelector('.filter-btn.active');
    if (activeFilter) {
        filterItems(activeFilter.getAttribute('data-filter'));
    }
}

// Filter items by type
function filterItems(filterType) {
    const items = document.querySelectorAll('.item-card');
    
    items.forEach(item => {
        const itemType = item.getAttribute('data-type');
        if (filterType === 'all' || itemType === filterType) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Upvote an item
function upvoteItem(itemId, card) {
    fetch(`/api/items/${itemId}/upvote`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        // Update the upvote count in the UI
        const countElement = card.querySelector('.upvote-count');
        countElement.textContent = data.upvotes;
        
        // No need to fetch all items again since we're just updating the count
    })
    .catch(error => console.error('Error upvoting item:', error));
}

// Delete an item
function deleteItem(itemId, wrapper) {
    fetch(`/api/items/${itemId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (response.ok) {
            // Remove the card from the UI
            wrapper.remove();
            // Refresh user stats
            fetchUserStats();
        } else {
            return response.json().then(err => {
                throw new Error(err.error || 'Failed to delete item');
            });
        }
    })
    .catch(error => {
        console.error('Error deleting item:', error);
        alert(error.message || 'Failed to delete item. Please try again.');
    });
}
