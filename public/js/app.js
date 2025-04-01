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

    // Handle delete all button
    const deleteAllBtn = document.getElementById('delete-all-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to delete ALL posts? This action cannot be undone.')) {
                deleteAllItems();
            }
        });
    }
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
                
                // Show admin controls if the user is prayas.abhinav@anu.edu.in
                const adminControls = document.getElementById('admin-controls');
                if (data.user.email === 'prayas.abhinav@anu.edu.in') {
                    adminControls.classList.remove('hidden');
                } else {
                    adminControls.classList.add('hidden');
                }
                
                // Load items
                fetchItems();
            } else {
                // User is not logged in
                document.getElementById('login-btn').classList.remove('hidden');
                document.getElementById('user-info').classList.add('hidden');
                document.getElementById('content-area').classList.add('hidden');
            }
        })
        .catch(error => console.error('Error fetching user status:', error));
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
    
    const itemData = {
        type: type,
        title: title,
        url: formData.get('url'),
        keywords: formData.get('keywords').split(',').map(keyword => keyword.trim())
    };
    
    fetch('/api/items', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemData)
    })
    .then(response => {
        if (response.ok) {
            form.reset();
            // Reset the form display
            titleGroup.classList.remove('hidden');
            descriptionGroup.classList.add('hidden');
            // Close the overlay
            document.getElementById('submission-overlay').classList.add('hidden');
            fetchItems(); // Refresh the list
            alert('Your submission was successful!');
        } else {
            alert('Failed to submit. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error submitting item:', error);
        alert('An error occurred. Please try again.');
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
        const card = itemElement.querySelector('.item-card');
        
        // Set data type attribute for styling and filtering
        card.setAttribute('data-type', item.type);
        
        // Fill in content
        card.querySelector('.item-title').textContent = item.title;
        
        // Handle URL display
        const urlElement = card.querySelector('.item-url');
        if (item.url) {
            urlElement.querySelector('a').href = item.url;
            urlElement.querySelector('a').textContent = item.type === 'project' ? 'View Project' : 'Reference Link';
        } else {
            urlElement.style.display = 'none';
        }
        
        // Add keywords
        const keywordsContainer = card.querySelector('.item-keywords');
        item.keywords.forEach(keyword => {
            const keywordSpan = document.createElement('span');
            keywordSpan.className = 'keyword';
            keywordSpan.textContent = keyword;
            keywordsContainer.appendChild(keywordSpan);
        });
        
        // Set upvote count
        card.querySelector('.upvote-count').textContent = item.upvotes;
        
        // Add upvote functionality
        card.querySelector('.upvote-btn').addEventListener('click', function() {
            upvoteItem(item._id, card);
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

// Delete all items
function deleteAllItems() {
    fetch('/api/items/delete-all', {
        method: 'DELETE'
    })
    .then(response => {
        if (response.ok) {
            fetchItems(); // Refresh the list (should be empty now)
            alert('All posts have been deleted successfully.');
        } else {
            alert('Failed to delete all posts. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error deleting all items:', error);
        alert('An error occurred. Please try again.');
    });
}
