document.addEventListener('DOMContentLoaded', function() {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const copyBtn = document.getElementById('copyBtn');
  const output = document.getElementById('output');
  const status = document.getElementById('status');

  let scrapedData = '';

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.className = `status ${isError ? 'error' : 'success'}`;
    status.style.display = 'block';
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }

  scrapeBtn.addEventListener('click', async () => {
    try {
      scrapeBtn.disabled = true;
      scrapeBtn.textContent = 'Scraping...';
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: scrapePageData
      });
      
      if (results && results[0] && results[0].result) {
        scrapedData = results[0].result;
        output.textContent = scrapedData;
        output.style.display = 'block';
        copyBtn.style.display = 'block';
        showStatus('Data scraped successfully!');
      } else {
        showStatus('No course data found on this page', true);
      }
    } catch (error) {
      console.error('Scraping error:', error);
      showStatus('Error scraping data: ' + error.message, true);
    } finally {
      scrapeBtn.disabled = false;
      scrapeBtn.textContent = 'Scrape Course Data';
    }
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(scrapedData);
      showStatus('Copied to clipboard!');
    } catch (error) {
      showStatus('Failed to copy to clipboard', true);
    }
  });
});

function scrapePageData() {
  function getCurriculumCategoryName() {
    // Try to find the curriculum category from various selectors
    const selectors = [
      'select[name*="curriculum"] option:checked',
      'select[name*="category"] option:checked',
      '.curriculum-category',
      '#curriculum-category',
      'select option:checked'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim() && !element.textContent.includes('Choose')) {
        return element.textContent.trim();
      }
    }
    
    // Fallback: look for any visible text that might indicate category
    const possibleCategories = document.querySelectorAll('*');
    for (const el of possibleCategories) {
      const text = el.textContent.trim();
      if (text.includes('Foundation Core') || 
          text.includes('Discipline Core') ||
          text.includes('Specialization Elective') ||
          text.includes('Open Elective') ||
          text.includes('Bridge Course')) {
        return text;
      }
    }
    
    return 'UnknownCategory';
  }

  function getVariableName(categoryName) {
    const mapping = {
      'FC - Foundation Core': 'foundationCore',
      'Foundation Core': 'foundationCore',
      'DLES - Discipline-linked Engineering Sciences': 'disciplineLinkedEngineeringSciences',
      'DC - Discipline Core': 'disciplineCore',
      'Discipline Core': 'disciplineCore',
      'SPE - Specialization Elective': 'specializationElective',
      'Specialization Elective': 'specializationElective',
      'PI - Projects and Internship': 'projectsAndInternship',
      'Projects and Internship': 'projectsAndInternship',
      'OE - Open Elective': 'openElective',
      'Open Elective': 'openElective',
      'BC - Bridge Course': 'bridgeCourse',
      'Bridge Course': 'bridgeCourse',
      'NGCR - Non-graded Core Requirement': 'nonGradedCoreRequirement',
      'Non-graded Core Requirement': 'nonGradedCoreRequirement'
    };
    
    return mapping[categoryName] || 'courseData';
  }

  function scrapeCourseTable() {
    const courseData = {};
    
    // Look for course code in dropdown or text
    let currentCourse = '';
    const courseSelect = document.querySelector('select[name*="course"], #course-list, .course-list select');
    if (courseSelect) {
      const selectedOption = courseSelect.querySelector('option:checked') || courseSelect.querySelector('option[selected]');
      if (selectedOption && selectedOption.value && !selectedOption.textContent.includes('Choose')) {
        currentCourse = selectedOption.textContent.trim();
      }
    }
    
    // If no course found in select, try to find it in the page
    if (!currentCourse) {
      const courseElements = document.querySelectorAll('*');
      for (const el of courseElements) {
        const text = el.textContent.trim();
        // Look for patterns like "BARB101L - Arabic" or similar course codes
        if (text.match(/^[A-Z]{2,4}\d{3}[A-Z]?\s*-\s*.+/) && text.length < 100) {
          currentCourse = text;
          break;
        }
      }
    }
    
    // Find tables with course data
    const tables = document.querySelectorAll('table');
    
    for (const table of tables) {
      const headers = Array.from(table.querySelectorAll('th, thead tr td')).map(th => th.textContent.trim().toLowerCase());
      
      // Check if this table has the expected headers
      if (headers.includes('slot detail') || headers.includes('venue') || headers.includes('faculty') || headers.includes('course type')) {
        const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
        
        if (rows.length > 0 && currentCourse) {
          courseData[currentCourse] = [];
          
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4) {
              const slotDetail = cells[0]?.textContent.trim() || '';
              const venue = cells[1]?.textContent.trim() || '';
              const faculty = cells[2]?.textContent.trim() || '';
              const courseType = cells[3]?.textContent.trim() || '';
              
              if (slotDetail || venue || faculty) {
                const entry = { slot: slotDetail, venue: venue, faculty: faculty };
                if (courseType) entry.courseType = courseType;
                courseData[currentCourse].push(entry);
              }
            }
          });
        }
      }
    }
    
    return courseData;
  }

  try {
    const categoryName = getCurriculumCategoryName();
    const variableName = getVariableName(categoryName);
    const courseData = scrapeCourseTable();
    
    if (Object.keys(courseData).length === 0) {
      return `// No course data found on this page
// Make sure you're on a page with course tables containing Slot Detail, Venue, Faculty columns`;
    }
    
    // Format the output
    let output = `export const ${variableName} = {\n`;
    
    for (const [courseName, courses] of Object.entries(courseData)) {
      output += `  "${courseName}": [\n`;
      
      courses.forEach((course, index) => {
        output += `    { slot: "${course.slot}", venue: "${course.venue}", faculty: "${course.faculty}"`;
        if (course.courseType) {
          output += `, courseType: "${course.courseType}"`;
        }
        output += ` }`;
        if (index < courses.length - 1) output += ',';
        output += '\n';
      });
      
      output += `  ],\n`;
    }
    
    output += `};\n\n// Category: ${categoryName}\n// Scraped ${Object.keys(courseData).length} course(s)`;
    
    return output;
    
  } catch (error) {
    return `// Error scraping data: ${error.message}
// Please make sure you're on the correct page with course tables`;
  }
}