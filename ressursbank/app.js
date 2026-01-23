/**
 * Ressursbank - Resource Bank Application
 * A playful and modern knowledge management app
 */

// ============================================
// Database Setup
// ============================================

const db = new Dexie('ressursbankDB');

db.version(1).stores({
    collections: '++id, name, createdAt, updatedAt',
    resources: '++id, collectionId, title, url, type, createdAt, favorite',
    notes: '++id, collectionId, title, createdAt, updatedAt'
});

// ============================================
// State
// ============================================

let currentCollectionId = null;
let currentResourceId = null;
let currentNoteId = null;
let deleteCallback = null;

// ============================================
// Color Map
// ============================================

const colorMap = {
    blue: 'var(--accent-blue)',
    purple: 'var(--accent-purple)',
    pink: 'var(--accent-pink)',
    green: 'var(--accent-green)',
    yellow: 'var(--accent-yellow)',
    orange: 'var(--accent-orange)'
};

const typeIcons = {
    article: '📄',
    video: '🎬',
    podcast: '🎧',
    book: '📖',
    tool: '🔧',
    other: '🔗'
};

// ============================================
// Bootstrap
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    bootstrap();
});

async function bootstrap() {
    // Load and render data
    await renderCollections();
    await updateStats();
    await renderActivity();

    // Setup event listeners
    setupModalListeners();
    setupFormListeners();
    setupSearchListeners();
    setupTabListeners();
    setupEditorToolbar();
    setupMiscListeners();
}

// ============================================
// Render Functions
// ============================================

async function renderCollections() {
    const collections = await db.collections.orderBy('updatedAt').reverse().toArray();
    const grid = document.getElementById('collectionsGrid');
    const emptyState = document.getElementById('emptyState');

    if (collections.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.add('visible');
        return;
    }

    emptyState.classList.remove('visible');

    // Get counts for each collection
    const collectionsWithCounts = await Promise.all(
        collections.map(async (collection) => {
            const resourceCount = await db.resources.where('collectionId').equals(collection.id).count();
            const noteCount = await db.notes.where('collectionId').equals(collection.id).count();
            return { ...collection, resourceCount, noteCount };
        })
    );

    grid.innerHTML = collectionsWithCounts.map(collection => `
        <div class="collection-card glass-card" data-id="${collection.id}" style="--collection-color: ${colorMap[collection.color] || colorMap.blue}">
            <span class="collection-card-icon">${collection.icon || '📚'}</span>
            <h3 class="collection-card-title">${escapeHtml(collection.name)}</h3>
            <p class="collection-card-desc">${escapeHtml(collection.description || 'Ingen beskrivelse')}</p>
            <div class="collection-card-meta">
                <span>🔗 ${collection.resourceCount} ressurser</span>
                <span>📝 ${collection.noteCount} notater</span>
            </div>
        </div>
    `).join('');

    // Add click listeners
    grid.querySelectorAll('.collection-card').forEach(card => {
        card.addEventListener('click', () => openCollectionDetail(parseInt(card.dataset.id)));
    });
}

async function renderActivity() {
    const activityList = document.getElementById('activityList');
    const activitySection = document.getElementById('activitySection');

    // Get recent items
    const recentResources = await db.resources.orderBy('createdAt').reverse().limit(3).toArray();
    const recentNotes = await db.notes.orderBy('createdAt').reverse().limit(3).toArray();

    // Combine and sort
    const activities = [
        ...recentResources.map(r => ({ type: 'resource', item: r, date: r.createdAt })),
        ...recentNotes.map(n => ({ type: 'note', item: n, date: n.createdAt }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    if (activities.length === 0) {
        activitySection.style.display = 'none';
        return;
    }

    activitySection.style.display = 'block';

    activityList.innerHTML = await Promise.all(activities.map(async (activity) => {
        const collection = await db.collections.get(activity.item.collectionId);
        const collectionName = collection ? collection.name : 'Ukjent samling';

        if (activity.type === 'resource') {
            return `
                <div class="activity-item" data-type="resource" data-id="${activity.item.id}">
                    <span class="activity-icon">${typeIcons[activity.item.type] || '🔗'}</span>
                    <div class="activity-content">
                        <h4>${escapeHtml(activity.item.title)}</h4>
                        <p>Lagt til i ${escapeHtml(collectionName)}</p>
                    </div>
                    <span class="activity-time">${formatRelativeTime(activity.date)}</span>
                </div>
            `;
        } else {
            return `
                <div class="activity-item" data-type="note" data-id="${activity.item.id}">
                    <span class="activity-icon">📝</span>
                    <div class="activity-content">
                        <h4>${escapeHtml(activity.item.title)}</h4>
                        <p>Notat i ${escapeHtml(collectionName)}</p>
                    </div>
                    <span class="activity-time">${formatRelativeTime(activity.date)}</span>
                </div>
            `;
        }
    })).then(items => items.join(''));

    // Add click listeners to activity items
    activityList.querySelectorAll('.activity-item').forEach(item => {
        item.addEventListener('click', async () => {
            const type = item.dataset.type;
            const id = parseInt(item.dataset.id);

            if (type === 'resource') {
                const resource = await db.resources.get(id);
                if (resource) {
                    await openCollectionDetail(resource.collectionId);
                    setTimeout(() => viewResource(id), 300);
                }
            } else {
                const note = await db.notes.get(id);
                if (note) {
                    await openCollectionDetail(note.collectionId);
                    setTimeout(() => {
                        switchTab('notes');
                        viewNote(id);
                    }, 300);
                }
            }
        });
    });
}

async function updateStats() {
    const collectionsCount = await db.collections.count();
    const resourcesCount = await db.resources.count();
    const notesCount = await db.notes.count();
    const favoritesCount = await db.resources.where('favorite').equals(1).count();

    document.getElementById('statCollections').textContent = collectionsCount;
    document.getElementById('statResources').textContent = resourcesCount;
    document.getElementById('statNotes').textContent = notesCount;
    document.getElementById('statFavorites').textContent = favoritesCount;

    // Show/hide welcome section based on whether user has data
    const welcomeSection = document.getElementById('welcomeSection');
    if (collectionsCount > 0) {
        welcomeSection.style.display = 'none';
    } else {
        welcomeSection.style.display = 'block';
    }
}

async function renderResources(collectionId) {
    const resources = await db.resources.where('collectionId').equals(collectionId).reverse().sortBy('createdAt');
    const list = document.getElementById('resourcesList');
    const empty = document.getElementById('emptyResources');
    const countEl = document.getElementById('resourceCount');

    countEl.textContent = resources.length;

    if (resources.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    list.innerHTML = resources.map(resource => {
        const tags = resource.tags ? resource.tags.split(',').map(t => t.trim()).filter(t => t) : [];
        return `
            <div class="resource-item" data-id="${resource.id}">
                <span class="resource-type-icon">${typeIcons[resource.type] || '🔗'}</span>
                <div class="resource-content">
                    <h4>${escapeHtml(resource.title)}</h4>
                    <div class="resource-url-preview">${escapeHtml(getDomain(resource.url))}</div>
                    ${resource.notes ? `<p class="resource-snippet">${escapeHtml(resource.notes)}</p>` : ''}
                    ${tags.length > 0 ? `
                        <div class="resource-tags-mini">
                            ${tags.slice(0, 3).map(tag => `<span class="tag-mini">${escapeHtml(tag)}</span>`).join('')}
                            ${tags.length > 3 ? `<span class="tag-mini">+${tags.length - 3}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="resource-actions">
                    <button class="resource-action-btn favorite ${resource.favorite ? 'active' : ''}" data-id="${resource.id}" title="Favoritt">
                        <svg viewBox="0 0 24 24" fill="${resource.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add click listeners
    list.querySelectorAll('.resource-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.resource-action-btn')) {
                viewResource(parseInt(item.dataset.id));
            }
        });
    });

    // Favorite toggle
    list.querySelectorAll('.resource-action-btn.favorite').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            const resource = await db.resources.get(id);
            await db.resources.update(id, { favorite: resource.favorite ? 0 : 1 });
            await renderResources(collectionId);
            await updateStats();
        });
    });
}

async function renderNotes(collectionId) {
    const notes = await db.notes.where('collectionId').equals(collectionId).reverse().sortBy('createdAt');
    const list = document.getElementById('notesList');
    const empty = document.getElementById('emptyNotes');
    const countEl = document.getElementById('noteCount');

    countEl.textContent = notes.length;

    if (notes.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    list.innerHTML = notes.map(note => {
        const plainText = stripHtml(note.content);
        return `
            <div class="note-card" data-id="${note.id}">
                <h4>${escapeHtml(note.title)}</h4>
                <p class="note-preview">${escapeHtml(plainText.substring(0, 150))}${plainText.length > 150 ? '...' : ''}</p>
                <span class="note-date">${formatDate(note.updatedAt || note.createdAt)}</span>
            </div>
        `;
    }).join('');

    // Add click listeners
    list.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', () => viewNote(parseInt(card.dataset.id)));
    });
}

// ============================================
// Modal Functions
// ============================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        modal.classList.remove('active');
    });
    document.body.style.overflow = '';
}

function setupModalListeners() {
    // Close on backdrop click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeAllModals();
            }
        });
    });

    // Close on close button click
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeAllModals());
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close search first if open
            const searchOverlay = document.getElementById('searchOverlay');
            if (searchOverlay.classList.contains('active')) {
                searchOverlay.classList.remove('active');
                return;
            }
            closeAllModals();
        }
    });
}

// ============================================
// Collection Functions
// ============================================

function openNewCollectionModal() {
    document.getElementById('collectionModalTitle').textContent = 'Ny samling';
    document.getElementById('collectionForm').reset();
    document.getElementById('collectionId').value = '';

    // Reset color picker
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
    document.querySelector('.color-option[data-color="blue"]').classList.add('active');

    // Reset icon picker
    document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('active'));
    document.querySelector('.icon-option[data-icon="📚"]').classList.add('active');

    openModal('collectionModal');
}

async function openEditCollectionModal(id) {
    const collection = await db.collections.get(id);
    if (!collection) return;

    document.getElementById('collectionModalTitle').textContent = 'Rediger samling';
    document.getElementById('collectionId').value = id;
    document.getElementById('collectionName').value = collection.name;
    document.getElementById('collectionDesc').value = collection.description || '';

    // Set color
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
    const colorOpt = document.querySelector(`.color-option[data-color="${collection.color || 'blue'}"]`);
    if (colorOpt) colorOpt.classList.add('active');

    // Set icon
    document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('active'));
    const iconOpt = document.querySelector(`.icon-option[data-icon="${collection.icon || '📚'}"]`);
    if (iconOpt) iconOpt.classList.add('active');

    openModal('collectionModal');
}

async function saveCollection(data) {
    const id = document.getElementById('collectionId').value;
    const now = new Date().toISOString();

    if (id) {
        // Update existing
        await db.collections.update(parseInt(id), {
            ...data,
            updatedAt: now
        });
        showToast('success', 'Samling oppdatert', 'Endringene dine er lagret');
    } else {
        // Create new
        await db.collections.add({
            ...data,
            createdAt: now,
            updatedAt: now
        });
        showToast('success', 'Samling opprettet', 'Din nye samling er klar til bruk');
    }

    closeAllModals();
    await renderCollections();
    await updateStats();
}

async function openCollectionDetail(id) {
    const collection = await db.collections.get(id);
    if (!collection) return;

    currentCollectionId = id;
    document.getElementById('currentCollectionId').value = id;

    // Update header info
    document.getElementById('detailIcon').textContent = collection.icon || '📚';
    document.getElementById('detailTitle').textContent = collection.name;
    document.getElementById('detailDesc').textContent = collection.description || '';

    // Set header color
    const modal = document.getElementById('collectionDetailModal');
    modal.querySelector('.collection-detail-header').style.setProperty('--collection-color', colorMap[collection.color] || colorMap.blue);

    // Reset to resources tab
    switchTab('resources');

    // Render content
    await renderResources(id);
    await renderNotes(id);

    openModal('collectionDetailModal');
}

async function deleteCollection(id) {
    // Delete all resources and notes in the collection
    await db.resources.where('collectionId').equals(id).delete();
    await db.notes.where('collectionId').equals(id).delete();
    await db.collections.delete(id);

    closeAllModals();
    await renderCollections();
    await updateStats();
    await renderActivity();
    showToast('success', 'Samling slettet', 'Samlingen og alt innholdet er fjernet');
}

// ============================================
// Resource Functions
// ============================================

function openAddResourceModal() {
    document.getElementById('resourceModalTitle').textContent = 'Legg til ressurs';
    document.getElementById('resourceForm').reset();
    document.getElementById('resourceId').value = '';
    document.getElementById('resourceCollectionId').value = currentCollectionId;

    // Reset type selector
    document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.type-btn[data-type="article"]').classList.add('active');

    openModal('resourceModal');
}

async function openEditResourceModal(id) {
    const resource = await db.resources.get(id);
    if (!resource) return;

    document.getElementById('resourceModalTitle').textContent = 'Rediger ressurs';
    document.getElementById('resourceId').value = id;
    document.getElementById('resourceCollectionId').value = resource.collectionId;
    document.getElementById('resourceUrl').value = resource.url;
    document.getElementById('resourceTitle').value = resource.title;
    document.getElementById('resourceNotes').value = resource.notes || '';
    document.getElementById('resourceTags').value = resource.tags || '';

    // Set type
    document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    const typeBtn = document.querySelector(`.type-btn[data-type="${resource.type || 'article'}"]`);
    if (typeBtn) typeBtn.classList.add('active');

    closeModal('viewResourceModal');
    openModal('resourceModal');
}

async function saveResource(data) {
    const id = document.getElementById('resourceId').value;
    const collectionId = parseInt(document.getElementById('resourceCollectionId').value);
    const now = new Date().toISOString();

    if (id) {
        await db.resources.update(parseInt(id), {
            ...data,
            updatedAt: now
        });
        showToast('success', 'Ressurs oppdatert', 'Endringene dine er lagret');
    } else {
        await db.resources.add({
            ...data,
            collectionId,
            createdAt: now,
            favorite: 0
        });
        showToast('success', 'Ressurs lagt til', 'Din nye ressurs er lagret');
    }

    // Update collection timestamp
    await db.collections.update(collectionId, { updatedAt: now });

    closeAllModals();
    openModal('collectionDetailModal');
    await renderResources(collectionId);
    await updateStats();
    await renderActivity();
}

async function viewResource(id) {
    const resource = await db.resources.get(id);
    if (!resource) return;

    currentResourceId = id;
    document.getElementById('viewResourceId').value = id;
    document.getElementById('viewResourceType').textContent = `${typeIcons[resource.type] || '🔗'} ${getTypeName(resource.type)}`;
    document.getElementById('viewResourceTitle').textContent = resource.title;
    document.getElementById('viewResourceUrl').href = resource.url;
    document.getElementById('viewResourceUrl').querySelector('span').textContent = resource.url;
    document.getElementById('openResourceBtn').href = resource.url;
    document.getElementById('viewResourceNotes').textContent = resource.notes || 'Ingen notater';
    document.getElementById('viewResourceDate').textContent = `Lagt til ${formatDate(resource.createdAt)}`;

    // Tags
    const tagsContainer = document.getElementById('viewResourceTags');
    if (resource.tags) {
        const tags = resource.tags.split(',').map(t => t.trim()).filter(t => t);
        tagsContainer.innerHTML = tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
        tagsContainer.style.display = 'flex';
    } else {
        tagsContainer.style.display = 'none';
    }

    openModal('viewResourceModal');
}

async function deleteResource(id) {
    const resource = await db.resources.get(id);
    if (!resource) return;

    await db.resources.delete(id);

    closeAllModals();
    openModal('collectionDetailModal');
    await renderResources(resource.collectionId);
    await updateStats();
    await renderActivity();
    showToast('success', 'Ressurs slettet', 'Ressursen er fjernet fra samlingen');
}

// ============================================
// Note Functions
// ============================================

function openAddNoteModal() {
    document.getElementById('noteModalTitle').textContent = 'Nytt notat';
    document.getElementById('noteForm').reset();
    document.getElementById('noteId').value = '';
    document.getElementById('noteCollectionId').value = currentCollectionId;
    document.getElementById('noteEditor').innerHTML = '';

    openModal('noteModal');
}

async function openEditNoteModal(id) {
    const note = await db.notes.get(id);
    if (!note) return;

    document.getElementById('noteModalTitle').textContent = 'Rediger notat';
    document.getElementById('noteId').value = id;
    document.getElementById('noteCollectionId').value = note.collectionId;
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteEditor').innerHTML = note.content || '';
    document.getElementById('noteTags').value = note.tags || '';

    closeModal('viewNoteModal');
    openModal('noteModal');
}

async function saveNote(data) {
    const id = document.getElementById('noteId').value;
    const collectionId = parseInt(document.getElementById('noteCollectionId').value);
    const now = new Date().toISOString();

    if (id) {
        await db.notes.update(parseInt(id), {
            ...data,
            updatedAt: now
        });
        showToast('success', 'Notat oppdatert', 'Endringene dine er lagret');
    } else {
        await db.notes.add({
            ...data,
            collectionId,
            createdAt: now,
            updatedAt: now
        });
        showToast('success', 'Notat opprettet', 'Ditt nye notat er lagret');
    }

    // Update collection timestamp
    await db.collections.update(collectionId, { updatedAt: now });

    closeAllModals();
    openModal('collectionDetailModal');
    switchTab('notes');
    await renderNotes(collectionId);
    await updateStats();
    await renderActivity();
}

async function viewNote(id) {
    const note = await db.notes.get(id);
    if (!note) return;

    currentNoteId = id;
    document.getElementById('viewNoteId').value = id;
    document.getElementById('viewNoteTitle').textContent = note.title;
    document.getElementById('viewNoteContent').innerHTML = note.content || '';
    document.getElementById('viewNoteDate').textContent = `Sist oppdatert ${formatDate(note.updatedAt || note.createdAt)}`;

    // Tags
    const tagsContainer = document.getElementById('viewNoteTags');
    if (note.tags) {
        const tags = note.tags.split(',').map(t => t.trim()).filter(t => t);
        tagsContainer.innerHTML = tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
        tagsContainer.style.display = 'flex';
    } else {
        tagsContainer.style.display = 'none';
    }

    openModal('viewNoteModal');
}

async function deleteNote(id) {
    const note = await db.notes.get(id);
    if (!note) return;

    await db.notes.delete(id);

    closeAllModals();
    openModal('collectionDetailModal');
    switchTab('notes');
    await renderNotes(note.collectionId);
    await updateStats();
    await renderActivity();
    showToast('success', 'Notat slettet', 'Notatet er fjernet fra samlingen');
}

// ============================================
// Tab Functions
// ============================================

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `${tabName}Pane`);
    });
}

function setupTabListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

// ============================================
// Search Functions
// ============================================

function setupSearchListeners() {
    const searchToggle = document.getElementById('searchToggle');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');

    searchToggle.addEventListener('click', () => {
        searchOverlay.classList.add('active');
        setTimeout(() => searchInput.focus(), 100);
    });

    searchOverlay.addEventListener('click', (e) => {
        if (e.target === searchOverlay) {
            searchOverlay.classList.remove('active');
        }
    });

    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => performSearch(searchInput.value), 200);
    });
}

async function performSearch(query) {
    const resultsContainer = document.getElementById('searchResults');

    if (!query.trim()) {
        resultsContainer.innerHTML = '';
        return;
    }

    const searchTerm = query.toLowerCase();

    // Search collections
    const collections = await db.collections.toArray();
    const matchedCollections = collections.filter(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        (c.description && c.description.toLowerCase().includes(searchTerm))
    );

    // Search resources
    const resources = await db.resources.toArray();
    const matchedResources = resources.filter(r =>
        r.title.toLowerCase().includes(searchTerm) ||
        r.url.toLowerCase().includes(searchTerm) ||
        (r.notes && r.notes.toLowerCase().includes(searchTerm)) ||
        (r.tags && r.tags.toLowerCase().includes(searchTerm))
    );

    // Search notes
    const notes = await db.notes.toArray();
    const matchedNotes = notes.filter(n =>
        n.title.toLowerCase().includes(searchTerm) ||
        (n.content && stripHtml(n.content).toLowerCase().includes(searchTerm)) ||
        (n.tags && n.tags.toLowerCase().includes(searchTerm))
    );

    if (matchedCollections.length === 0 && matchedResources.length === 0 && matchedNotes.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-dim); padding: 40px;">Ingen resultater funnet</p>';
        return;
    }

    let html = '';

    // Collections
    matchedCollections.forEach(c => {
        html += `
            <div class="search-result-item" data-type="collection" data-id="${c.id}">
                <span class="search-result-icon">${c.icon || '📚'}</span>
                <div class="search-result-content">
                    <h4>${escapeHtml(c.name)}</h4>
                    <p>Samling</p>
                </div>
            </div>
        `;
    });

    // Resources
    for (const r of matchedResources) {
        const collection = await db.collections.get(r.collectionId);
        html += `
            <div class="search-result-item" data-type="resource" data-id="${r.id}">
                <span class="search-result-icon">${typeIcons[r.type] || '🔗'}</span>
                <div class="search-result-content">
                    <h4>${escapeHtml(r.title)}</h4>
                    <p>Ressurs i ${escapeHtml(collection ? collection.name : 'Ukjent')}</p>
                </div>
            </div>
        `;
    }

    // Notes
    for (const n of matchedNotes) {
        const collection = await db.collections.get(n.collectionId);
        html += `
            <div class="search-result-item" data-type="note" data-id="${n.id}">
                <span class="search-result-icon">📝</span>
                <div class="search-result-content">
                    <h4>${escapeHtml(n.title)}</h4>
                    <p>Notat i ${escapeHtml(collection ? collection.name : 'Ukjent')}</p>
                </div>
            </div>
        `;
    }

    resultsContainer.innerHTML = html;

    // Add click listeners
    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', async () => {
            const type = item.dataset.type;
            const id = parseInt(item.dataset.id);
            document.getElementById('searchOverlay').classList.remove('active');
            document.getElementById('searchInput').value = '';

            if (type === 'collection') {
                await openCollectionDetail(id);
            } else if (type === 'resource') {
                const resource = await db.resources.get(id);
                if (resource) {
                    await openCollectionDetail(resource.collectionId);
                    setTimeout(() => viewResource(id), 300);
                }
            } else if (type === 'note') {
                const note = await db.notes.get(id);
                if (note) {
                    await openCollectionDetail(note.collectionId);
                    setTimeout(() => {
                        switchTab('notes');
                        viewNote(id);
                    }, 300);
                }
            }
        });
    });
}

// ============================================
// Editor Toolbar
// ============================================

function setupEditorToolbar() {
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const command = btn.dataset.command;
            executeEditorCommand(command);
        });
    });
}

function executeEditorCommand(command) {
    const editor = document.getElementById('noteEditor');
    editor.focus();

    switch (command) {
        case 'bold':
            document.execCommand('bold', false, null);
            break;
        case 'italic':
            document.execCommand('italic', false, null);
            break;
        case 'underline':
            document.execCommand('underline', false, null);
            break;
        case 'heading':
            document.execCommand('formatBlock', false, '<h2>');
            break;
        case 'quote':
            document.execCommand('formatBlock', false, '<blockquote>');
            break;
        case 'ul':
            document.execCommand('insertUnorderedList', false, null);
            break;
        case 'ol':
            document.execCommand('insertOrderedList', false, null);
            break;
        case 'checklist':
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.style.marginRight = '8px';
                range.insertNode(checkbox);
            }
            break;
        case 'link':
            const url = prompt('Skriv inn URL:');
            if (url) {
                document.execCommand('createLink', false, url);
            }
            break;
        case 'highlight':
            document.execCommand('hiliteColor', false, 'rgba(251, 191, 36, 0.3)');
            break;
    }
}

// ============================================
// Form Listeners
// ============================================

function setupFormListeners() {
    // Collection form
    document.getElementById('collectionForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const activeColor = document.querySelector('.color-option.active');
        const activeIcon = document.querySelector('.icon-option.active');

        saveCollection({
            name: document.getElementById('collectionName').value.trim(),
            description: document.getElementById('collectionDesc').value.trim(),
            color: activeColor ? activeColor.dataset.color : 'blue',
            icon: activeIcon ? activeIcon.dataset.icon : '📚'
        });
    });

    // Color picker
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });

    // Icon picker
    document.querySelectorAll('.icon-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.icon-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });

    // Resource form
    document.getElementById('resourceForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const activeType = document.querySelector('.type-btn.active');

        saveResource({
            url: document.getElementById('resourceUrl').value.trim(),
            title: document.getElementById('resourceTitle').value.trim(),
            type: activeType ? activeType.dataset.type : 'article',
            notes: document.getElementById('resourceNotes').value.trim(),
            tags: document.getElementById('resourceTags').value.trim()
        });
    });

    // Type selector
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Note form
    document.getElementById('noteForm').addEventListener('submit', (e) => {
        e.preventDefault();

        saveNote({
            title: document.getElementById('noteTitle').value.trim(),
            content: document.getElementById('noteEditor').innerHTML,
            tags: document.getElementById('noteTags').value.trim()
        });
    });

    // Confirm delete
    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        if (deleteCallback) {
            deleteCallback();
            deleteCallback = null;
        }
    });
}

// ============================================
// Misc Listeners
// ============================================

function setupMiscListeners() {
    // New collection buttons
    document.getElementById('newCollectionBtn').addEventListener('click', openNewCollectionModal);
    document.getElementById('emptyNewCollection').addEventListener('click', openNewCollectionModal);

    // Edit collection
    document.getElementById('editCollectionBtn').addEventListener('click', () => {
        if (currentCollectionId) {
            closeModal('collectionDetailModal');
            openEditCollectionModal(currentCollectionId);
        }
    });

    // Delete collection
    document.getElementById('deleteCollectionBtn').addEventListener('click', () => {
        if (currentCollectionId) {
            document.getElementById('confirmMessage').textContent = 'Er du sikker på at du vil slette denne samlingen? Alle ressurser og notater i samlingen vil også bli slettet.';
            deleteCallback = () => deleteCollection(currentCollectionId);
            openModal('confirmModal');
        }
    });

    // Add resource button
    document.getElementById('addResourceBtn').addEventListener('click', openAddResourceModal);

    // Add note button
    document.getElementById('addNoteBtn').addEventListener('click', openAddNoteModal);

    // Edit resource
    document.getElementById('editResourceBtn').addEventListener('click', () => {
        const id = document.getElementById('viewResourceId').value;
        if (id) openEditResourceModal(parseInt(id));
    });

    // Delete resource
    document.getElementById('deleteResourceBtn').addEventListener('click', () => {
        const id = document.getElementById('viewResourceId').value;
        if (id) {
            document.getElementById('confirmMessage').textContent = 'Er du sikker på at du vil slette denne ressursen?';
            deleteCallback = () => deleteResource(parseInt(id));
            openModal('confirmModal');
        }
    });

    // Edit note
    document.getElementById('editNoteBtn').addEventListener('click', () => {
        const id = document.getElementById('viewNoteId').value;
        if (id) openEditNoteModal(parseInt(id));
    });

    // Delete note
    document.getElementById('deleteNoteBtn').addEventListener('click', () => {
        const id = document.getElementById('viewNoteId').value;
        if (id) {
            document.getElementById('confirmMessage').textContent = 'Er du sikker på at du vil slette dette notatet?';
            deleteCallback = () => deleteNote(parseInt(id));
            openModal('confirmModal');
        }
    });

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const view = btn.dataset.view;
            const grid = document.getElementById('collectionsGrid');
            if (view === 'list') {
                grid.style.gridTemplateColumns = '1fr';
            } else {
                grid.style.gridTemplateColumns = '';
            }
        });
    });
}

// ============================================
// Toast Notifications
// ============================================

function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <div class="toast-content">
            <h4>${escapeHtml(title)}</h4>
            <p>${escapeHtml(message)}</p>
        </div>
    `;

    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// Utility Functions
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

function getDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return url;
    }
}

function getTypeName(type) {
    const names = {
        article: 'Artikkel',
        video: 'Video',
        podcast: 'Podcast',
        book: 'Bok',
        tool: 'Verktøy',
        other: 'Annet'
    };
    return names[type] || 'Ressurs';
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('no-NO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Akkurat nå';
    if (diffMins < 60) return `${diffMins} min siden`;
    if (diffHours < 24) return `${diffHours} time${diffHours > 1 ? 'r' : ''} siden`;
    if (diffDays < 7) return `${diffDays} dag${diffDays > 1 ? 'er' : ''} siden`;
    return formatDate(dateString);
}
