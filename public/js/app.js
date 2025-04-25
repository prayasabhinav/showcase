// Add currentUser variable at the top of the file
let currentUser = null;

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

    // Handle comments overlay
    const commentsOverlay = document.getElementById('comments-overlay');
    const closeCommentsBtn = document.getElementById('close-comments');
    const commentText = document.getElementById('comment-text');
    const submitCommentBtn = document.getElementById('submit-comment');
    let currentItemId = null;

    closeCommentsBtn.addEventListener('click', function() {
        commentsOverlay.classList.add('hidden');
        commentText.value = '';
        currentItemId = null;
    });

    commentsOverlay.addEventListener('click', function(e) {
        if (e.target === commentsOverlay) {
            commentsOverlay.classList.add('hidden');
            commentText.value = '';
            currentItemId = null;
        }
    });

    // Handle voters overlay
    const votersOverlay = document.getElementById('voters-overlay');
    const closeVotersBtn = document.getElementById('close-voters');

    closeVotersBtn.addEventListener('click', function() {
        votersOverlay.classList.add('hidden');
    });

    votersOverlay.addEventListener('click', function(e) {
        if (e.target === votersOverlay) {
            votersOverlay.classList.add('hidden');
        }
    });
});

// Fetch user login status
function fetchUserStatus() {
    fetch('/api/user')
        .then(response => response.json())
        .then(data => {
            if (data.authenticated) {
                // Set currentUser
                currentUser = data.user;
                
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
                currentUser = null;
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
    fetch('/api/user/stats')
        .then(response => response.json())
        .then(data => {
            const ideasCountElement = document.getElementById('ideas-count');
            const projectsCountElement = document.getElementById('projects-count');
            
            if (ideasCountElement) {
                ideasCountElement.textContent = data.weekIdeas || 0;
            }
            
            if (projectsCountElement) {
                projectsCountElement.textContent = data.monthProjects || 0;
            }
        })
        .catch(error => {
            console.error('Error fetching user stats:', error);
            const ideasCountElement = document.getElementById('ideas-count');
            const projectsCountElement = document.getElementById('projects-count');
            
            if (ideasCountElement) {
                ideasCountElement.textContent = '0';
            }
            
            if (projectsCountElement) {
                projectsCountElement.textContent = '0';
            }
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
        const upvoteBtn = card.querySelector('.upvote-btn');
        
        // Check if user has already upvoted or is the author
        fetch('/api/user')
            .then(response => response.json())
            .then(data => {
                if (data.authenticated) {
                    const isAuthor = item.createdBy && item.createdBy._id === data.user._id;
                    const hasUpvoted = item.upvoters && item.upvoters.some(upvote => 
                        upvote.user.toString() === data.user._id.toString()
                    );
                    
                    if (isAuthor || hasUpvoted) {
                        upvoteBtn.disabled = true;
                        upvoteBtn.style.opacity = '0.5';
                        upvoteBtn.style.cursor = 'not-allowed';
                        
                        if (isAuthor) {
                            upvoteBtn.title = "You cannot upvote your own post";
                        } else if (hasUpvoted) {
                            upvoteBtn.title = "You have already upvoted this post";
                        }
                    }
                }
            });
        
        upvoteBtn.addEventListener('click', function() {
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
        
        // Handle comment link
        const commentLink = wrapper.querySelector('.comment-link');
        if (item.comments && item.comments.length > 0) {
            commentLink.textContent = 'Comment/View Comments';
        } else {
            commentLink.textContent = 'Comment';
        }
        commentLink.addEventListener('click', function(e) {
            e.preventDefault();
            showComments(item._id);
        });
        
        // Handle voters link
        const votersLink = wrapper.querySelector('.voters-link');
        votersLink.addEventListener('click', function(e) {
            e.preventDefault();
            showVoters(item._id);
        });
        
        // Add delete link for admin or item owner
        const deleteLink = wrapper.querySelector('.delete-link');
        deleteLink.style.display = 'none'; // Hidden by default
        
        // Check if user is admin or the owner of the item
        fetch('/api/user')
            .then(response => response.json())
            .then(data => {
                if (data.authenticated) {
                    // Show delete button for admin or item owner
                    if (data.user.email === 'prayas.abhinav@anu.edu.in' || 
                        (item.createdBy && item.createdBy._id === data.user._id)) {
                        deleteLink.style.display = 'block';
                        // Add admin indicator if user is admin
                        if (data.user.email === 'prayas.abhinav@anu.edu.in') {
                            deleteLink.textContent = 'Delete (Admin)';
                        } else {
                            deleteLink.textContent = 'Delete';
                        }
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
        method: 'POST',
        credentials: 'include',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Failed to upvote item');
            });
        }
        return response.json();
    })
    .then(data => {
        // Update the upvote count
        const upvoteCount = card.querySelector('.upvote-count');
        upvoteCount.textContent = data.upvotes;
        
        // Disable the upvote button
        const upvoteBtn = card.querySelector('.upvote-btn');
        upvoteBtn.disabled = true;
        upvoteBtn.style.opacity = '0.5';
        upvoteBtn.style.cursor = 'not-allowed';
        
        // Show success message
        alert('Item upvoted successfully!');
    })
    .catch(err => {
        console.error('Error upvoting item:', err);
        alert(err.message || 'Failed to upvote item. Please try again.');
    });
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

// Show voters for an item
function showVoters(itemId) {
    const votersOverlay = document.getElementById('voters-overlay');
    const votersContainer = document.getElementById('voters-container');
    
    // Clear previous voters
    votersContainer.innerHTML = '';
    
    // Show loading state
    votersContainer.innerHTML = '<p>Loading voters...</p>';
    votersOverlay.classList.remove('hidden');
    
    // Fetch voters
    fetch(`/api/items/${itemId}/upvoters`, {
        credentials: 'include',
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch voters');
        }
        return response.json();
    })
    .then(voters => {
        votersContainer.innerHTML = '';
        
        if (!voters || voters.length === 0) {
            votersContainer.innerHTML = '<p>No voters yet.</p>';
            return;
        }
        
        // Sort voters by date (most recent first)
        voters.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        voters.forEach(voter => {
            const voterElement = document.createElement('div');
            voterElement.className = 'voter';
            voterElement.innerHTML = `
                <span class="voter-name">${voter.name}</span>
                <span class="voter-date">${new Date(voter.date).toLocaleString()}</span>
            `;
            votersContainer.appendChild(voterElement);
        });
    })
    .catch(err => {
        console.error('Error fetching voters:', err);
        votersContainer.innerHTML = '<p>Error loading voters. Please try again.</p>';
    });
}

// Show comments for an item
function showComments(itemId) {
    currentItemId = itemId;
    const commentsOverlay = document.getElementById('comments-overlay');
    const commentsContainer = document.getElementById('comments-container');
    const commentForm = document.getElementById('comment-form');
    
    // Clear previous comments
    commentsContainer.innerHTML = '';
    
    // Show loading state
    commentsContainer.innerHTML = '<p>Loading comments...</p>';
    commentsOverlay.classList.remove('hidden');
    
    // Fetch comments
    fetch(`/api/items/${itemId}/comments`, {
        credentials: 'include',
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch comments');
        }
        return response.json();
    })
    .then(comments => {
        commentsContainer.innerHTML = '';
        
        if (!comments || comments.length === 0) {
            commentsContainer.innerHTML = '<p>No comments yet.</p>';
            return;
        }
        
        comments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            
            const isAuthor = comment.author._id === currentUser._id;
            
            commentElement.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.author.name}</span>
                    <span class="comment-date">${new Date(comment.date).toLocaleString()}</span>
                    ${isAuthor ? `<button class="delete-comment" data-comment-id="${comment._id}">Delete</button>` : ''}
                </div>
                <div class="comment-text">${comment.text}</div>
            `;
            
            commentsContainer.appendChild(commentElement);
        });
        
        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-comment').forEach(button => {
            button.addEventListener('click', async (e) => {
                const commentId = e.target.dataset.commentId;
                try {
                    const response = await fetch(`/api/items/${itemId}/comments/${commentId}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to delete comment');
                    }
                    
                    // Refresh comments
                    showComments(itemId);
                } catch (err) {
                    console.error('Error deleting comment:', err);
                    alert('Failed to delete comment');
                }
            });
        });
    })
    .catch(err => {
        console.error('Error fetching comments:', err);
        commentsContainer.innerHTML = '<p>Error loading comments. Please try again.</p>';
    });
}

// Handle comment submission
document.getElementById('submit-comment').addEventListener('click', function() {
    const commentText = document.getElementById('comment-text');
    const text = commentText.value.trim();
    
    if (!text) {
        alert('Please enter a comment');
        return;
    }
    
    if (!currentItemId) {
        alert('Error: No item selected');
        return;
    }
    
    fetch(`/api/items/${currentItemId}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    })
    .then(response => {
        if (response.ok) {
            commentText.value = '';
            showComments(currentItemId);
        } else {
            throw new Error('Failed to post comment');
        }
    })
    .catch(error => {
        console.error('Error posting comment:', error);
        alert('Failed to post comment. Please try again.');
    });
});
