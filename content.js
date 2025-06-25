// Content script for additional functionality if needed
// This runs on all pages but doesn't do anything unless called

// Optional: Add a floating button for quick access
function addFloatingButton() {
  if (document.getElementById('course-scraper-btn')) return;
  
  const button = document.createElement('button');
  button.id = 'course-scraper-btn';
  button.innerHTML = '📋 Scrape Courses';
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    background: #4CAF50;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    display: none;
  `;
  
  // Only show button if we detect course tables
  const hasTables = document.querySelectorAll('table').length > 0;
  const hasSlotColumn = document.querySelector('th, td')?.textContent.toLowerCase().includes('slot');
  
  if (hasTables && hasSlotColumn) {
    button.style.display = 'block';
  }
  
  button.onclick = () => {
    // This would trigger the same scraping function
    console.log('Course scraper button clicked');
  };
  
  document.body.appendChild(button);
}

// Only add the button if we're on a page that looks like it has course data
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addFloatingButton);
} else {
  addFloatingButton();
}