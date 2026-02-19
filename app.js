// Länder-Dropdown füllen
function populateCountries() {
    const select = document.getElementById('countrySelect');
    Object.keys(window.countries).sort().forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = `${window.countries[country].flag} ${country}`;
        select.appendChild(option);
    });
}

// Tab-Wechsel
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        item.classList.add('active');
        const tabId = item.dataset.tab === 'map' ? 'map-tab' : item.dataset.tab;
        document.getElementById(tabId).classList.add('active');
        
        if (item.dataset.tab === 'list') {
            displayBirds();
        } else if (item.dataset.tab === 'map') {
            setTimeout(() => initMap(), 100);
        }
    });
});

// Foto-Vorschau mit Komprimierung
document.getElementById('photoInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        compressImage(e.target.result, (compressedData) => {
            const preview = document.getElementById('photoPreview');
            preview.src = compressedData;
            preview.style.display = 'block';
            preview.dataset.compressed = compressedData;
        });
    };
    reader.onerror = function() {
        showToast('❌ Fehler beim Laden des Fotos');
    };
    reader.readAsDataURL(file);
});

// Bild-Komprimierung
function compressImage(dataUrl, callback) {
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = img.width;
        let height = img.height;
        const maxSize = 800; // Reduziert von 1200 für Cloud
        
        if (width > height) {
            if (width > maxSize) {
                height = height * (maxSize / width);
                width = maxSize;
            }
        } else {
            if (height > maxSize) {
                width = width * (maxSize / height);
                height = maxSize;
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedData = canvas.toDataURL('image/jpeg', 0.6);
        callback(compressedData);
    };
    img.src = dataUrl;
}

// Kamera/Galerie öffnen
function openCamera() {
    const input = document.getElementById('photoInput');
    input.setAttribute('capture', 'environment');
    input.click();
}

function openGallery() {
    const input = document.getElementById('photoInput');
    input.removeAttribute('capture');
    input.click();
}

// Formular absenden
document.getElementById('birdForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const isEditing = window.editingBirdId !== null;
    
    submitBtn.disabled = true;
    submitBtn.textContent = isEditing ? 'Wird aktualisiert...' : 'Wird gespeichert...';
    
    const name = document.getElementById('birdName').value;
    const latinName = document.getElementById('latinName').value;
    const birdDate = document.getElementById('birdDate').value;
    const country = document.getElementById('countrySelect').value;
    const locationDetails = document.getElementById('locationDetails').value;
    const notes = document.getElementById('notes').value;
    const photoPreview = document.getElementById('photoPreview');
    
    let photoData = photoPreview.dataset.compressed || photoPreview.src;
    
    if (!photoData || (!photoData.startsWith('data:image') && !photoData.startsWith('blob:'))) {
        submitBtn.disabled = false;
        submitBtn.textContent = isEditing ? 'Änderungen speichern' : 'Vogel speichern';
        showToast('❌ Bitte Foto auswählen');
        return;
    }
    
    try {
        const countryData = window.countries[country];
        const location = locationDetails ? `${locationDetails}, ${country}` : country;
        const dateObj = new Date(birdDate);
        const formattedDate = dateObj.toLocaleDateString('de-DE');
        
        const birdData = {
            name: name,
            latinName: latinName,
            country: country,
            countryFlag: countryData.flag,
            locationDetails: locationDetails,
            location: location,
            latitude: countryData.coords[0],
            longitude: countryData.coords[1],
            notes: notes,
            photo: photoData,
            date: formattedDate,
            dateRaw: birdDate
        };
        
        if (isEditing) {
            // Update existing bird
            const bird = window.birds.find(b => b.id === window.editingBirdId);
            if (bird && bird.firestoreId) {
                await window.updateBirdInFirestore(bird.firestoreId, birdData);
                showToast('✅ Vogel wurde aktualisiert!');
            }
            window.editingBirdId = null;
            resetForm();
            
            setTimeout(() => {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.querySelector('[data-tab="list"]').classList.add('active');
                document.getElementById('list').classList.add('active');
            }, 1000);
        } else {
            // Add new bird
            birdData.id = Date.now();
            await window.saveBirdToFirestore(birdData);
            resetForm();
            showSuccessMessage();
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Vogel speichern';
        
    } catch (error) {
        console.error('Fehler:', error);
        showToast('❌ Fehler beim Speichern');
        submitBtn.disabled = false;
        submitBtn.textContent = isEditing ? 'Änderungen speichern' : 'Vogel speichern';
    }
});

// Form reset
function resetForm() {
    document.getElementById('birdForm').reset();
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoPreview').dataset.compressed = '';
    document.getElementById('birdDate').valueAsDate = new Date();
    document.getElementById('submitBtn').textContent = 'Vogel speichern';
    window.editingBirdId = null;
}

// Success message
function showSuccessMessage() {
    const overlay = document.getElementById('successOverlay');
    overlay.classList.add('show');
    setTimeout(() => overlay.classList.remove('show'), 2000);
}

// Display birds
function displayBirds() {
    filterAndSort();
}

function filterAndSort() {
    const list = document.getElementById('birdList');
    const stats = document.getElementById('stats');
    const empty = document.getElementById('emptyState');
    
    if (window.birds.length === 0) {
        list.innerHTML = '';
        stats.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    
    empty.style.display = 'none';
    
    const filterCountry = document.getElementById('filterCountry').value;
    window.filteredBirds = filterCountry ? window.birds.filter(b => b.country === filterCountry) : [...window.birds];
    
    const sortBy = document.getElementById('sortBy').value;
    window.filteredBirds.sort((a, b) => {
        switch(sortBy) {
            case 'date':
                return new Date(b.dateRaw) - new Date(a.dateRaw);
            case 'date-asc':
                return new Date(a.dateRaw) - new Date(b.dateRaw);
            case 'name':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'country':
                return a.country.localeCompare(b.country);
            case 'country-desc':
                return b.country.localeCompare(a.country);
            default:
                return 0;
        }
    });
    
    const countriesVisited = [...new Set(window.birds.map(b => b.country))];
    stats.innerHTML = `
        <div class="stat-card">
            <h3>${window.filteredBirds.length}</h3>
            <p>${filterCountry ? 'Gefiltert' : 'Vögel'}</p>
        </div>
        <div class="stat-card">
            <h3>${countriesVisited.length}</h3>
            <p>Länder</p>
        </div>
        <div class="stat-card">
            <h3>${window.birds.length}</h3>
            <p>Gesamt</p>
        </div>
    `;
    
    list.innerHTML = window.filteredBirds.map(bird => `
        <div class="bird-card">
            <img src="${bird.photo}" alt="${bird.name}">
            <div class="bird-info">
                <h3>${bird.name}</h3>
                ${bird.latinName ? `<p style="font-style: italic; color: #888;">${bird.latinName}</p>` : ''}
                <p><span class="country-flag">${bird.countryFlag}</span>${bird.location}</p>
                <p>📅 ${bird.date}</p>
                <div class="bird-actions">
                    <button class="btn-small btn-view" onclick="showBirdDetails(${bird.id})">Details</button>
                    <button class="btn-small btn-edit" onclick="editBird(${bird.id})">Bearbeiten</button>
                    <button class="btn-small btn-delete" onclick="deleteBird(${bird.id})">Löschen</button>
                </div>
            </div>
        </div>
    `).join('');
    
    updateCountryFilter();
}

function updateCountryFilter() {
    const filterSelect = document.getElementById('filterCountry');
    const currentValue = filterSelect.value;
    const countries = [...new Set(window.birds.map(b => b.country))].sort();
    
    filterSelect.innerHTML = '<option value="">Alle Länder</option>' + 
        countries.map(country => {
            const bird = window.birds.find(b => b.country === country);
            return `<option value="${country}">${bird.countryFlag} ${country}</option>`;
        }).join('');
    
    filterSelect.value = currentValue;
}

// Show bird details
function showBirdDetails(id) {
    const bird = window.birds.find(b => b.id === id);
    document.getElementById('modalTitle').textContent = bird.name;
    document.getElementById('modalBody').innerHTML = `
        <img src="${bird.photo}" class="modal-image" alt="${bird.name}">
        <div class="modal-info">
            ${bird.latinName ? `<p><strong>Lateinischer Name:</strong> <em>${bird.latinName}</em></p>` : ''}
            <p><strong>Land:</strong> <span class="country-flag">${bird.countryFlag}</span>${bird.country}</p>
            ${bird.locationDetails ? `<p><strong>Genauer Ort:</strong> ${bird.locationDetails}</p>` : ''}
            <p><strong>Datum:</strong> ${bird.date}</p>
            ${bird.notes ? `<p><strong>Notizen:</strong> ${bird.notes}</p>` : ''}
        </div>
    `;
    document.getElementById('birdModal').classList.add('active');
}

function closeModal() {
    document.getElementById('birdModal').classList.remove('active');
}

// Delete bird
async function deleteBird(id) {
    if (confirm('Vogel wirklich löschen?')) {
        const bird = window.birds.find(b => b.id === id);
        if (bird && bird.firestoreId) {
            await window.deleteBirdFromFirestore(bird.firestoreId);
            showToast('Vogel gelöscht');
        }
    }
}

// Edit bird
function editBird(id) {
    const bird = window.birds.find(b => b.id === id);
    if (!bird) return;
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="add"]').classList.add('active');
    document.getElementById('add').classList.add('active');
    
    window.editingBirdId = bird.id;
    document.getElementById('birdName').value = bird.name;
    document.getElementById('latinName').value = bird.latinName || '';
    document.getElementById('birdDate').value = bird.dateRaw;
    document.getElementById('countrySelect').value = bird.country;
    document.getElementById('locationDetails').value = bird.locationDetails || '';
    document.getElementById('notes').value = bird.notes || '';
    
    const preview = document.getElementById('photoPreview');
    preview.src = bird.photo;
    preview.dataset.compressed = bird.photo;
    preview.style.display = 'block';
    
    document.getElementById('submitBtn').textContent = 'Änderungen speichern';
    window.scrollTo(0, 0);
    showToast('📝 Bearbeite: ' + bird.name);
}

// Map
function initMap() {
    if (window.map) {
        window.map.remove();
    }
    
    window.map = L.map('map').setView([30, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(window.map);
    
    const locationGroups = {};
    window.birds.forEach(bird => {
        const key = `${bird.latitude},${bird.longitude}`;
        if (!locationGroups[key]) {
            locationGroups[key] = [];
        }
        locationGroups[key].push(bird);
    });
    
    Object.entries(locationGroups).forEach(([key, birdsAtLocation]) => {
        const [lat, lng] = key.split(',').map(Number);
        const count = birdsAtLocation.length;
        
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-cluster" style="width: ${30 + count * 5}px; height: ${30 + count * 5}px; font-size: ${12 + count}px;">${count}</div>`,
            iconSize: [30 + count * 5, 30 + count * 5]
        });
        
        const marker = L.marker([lat, lng], { icon: icon }).addTo(window.map);
        
        marker.on('click', () => {
            window.currentPopupBirds = birdsAtLocation;
            window.currentPopupIndex = 0;
            showPopupContent(marker);
        });
    });
    
    if (window.birds.length > 0) {
        const group = L.featureGroup(
            Object.keys(locationGroups).map(key => {
                const [lat, lng] = key.split(',').map(Number);
                return L.marker([lat, lng]);
            })
        );
        window.map.fitBounds(group.getBounds().pad(0.1));
    }
}

function showPopupContent(marker) {
    const bird = window.currentPopupBirds[window.currentPopupIndex];
    const totalCount = window.currentPopupBirds.length;
    
    const popupContent = `
        <div style="text-align: center; min-width: 200px;">
            <img src="${bird.photo}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;">
            <strong style="display: block; margin-bottom: 5px; font-size: 1.1em;">${bird.name}</strong>
            ${bird.latinName ? `<em style="display: block; font-size: 0.85em; color: #888; margin-bottom: 5px;">${bird.latinName}</em>` : ''}
            <span style="font-size: 1.2em;">${bird.countryFlag}</span> ${bird.country}<br>
            <small style="color: #666;">${bird.date}</small>
            ${totalCount > 1 ? `
                <div class="popup-navigation">
                    <button class="popup-nav-btn" onclick="navigatePopup(-1)" ${window.currentPopupIndex === 0 ? 'disabled' : ''}>◀ Zurück</button>
                    <span class="popup-counter">${window.currentPopupIndex + 1} / ${totalCount}</span>
                    <button class="popup-nav-btn" onclick="navigatePopup(1)" ${window.currentPopupIndex === totalCount - 1 ? 'disabled' : ''}>Weiter ▶</button>
                </div>
            ` : ''}
        </div>
    `;
    
    marker.bindPopup(popupContent, { maxWidth: 250 }).openPopup();
}

function navigatePopup(direction) {
    window.currentPopupIndex += direction;
    window.currentPopupIndex = Math.max(0, Math.min(window.currentPopupIndex, window.currentPopupBirds.length - 1));
    
    window.map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.getPopup() && layer.getPopup().isOpen()) {
            showPopupContent(layer);
        }
    });
}

// Toast
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}
