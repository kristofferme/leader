const db = new Dexie('lederkompassDB');
db.version(1).stores({
    pulses: '++id,timestamp,score',
    priorities: '++id,createdAt,completed',
    delegations: '++id,createdAt,status',
    oneOnOnes: '++id,date,status',
    decisions: '++id,createdAt',
    adminTasks: '++id,due,completed',
    focus: '++id,dateKey',
    favorites: '++id,text'
});

const formatDate = (iso, options = {}) => {
    if (!iso) return 'Ikke angitt';
    const date = new Date(iso);
    if (Number.isNaN(date)) return iso;
    return new Intl.DateTimeFormat('no-NO', {
        day: '2-digit',
        month: 'short',
        ...options
    }).format(date);
};

const formatDateTime = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date)) return iso;
    return new Intl.DateTimeFormat('no-NO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const modalElements = new Map();
let timelineChart;
let timelineModalChart;

const pulseLabels = {
    1: '1 – Bekymret',
    2: '2 – Urolig',
    3: '3 – Stabil',
    4: '4 – God',
    5: '5 – Energisk'
};

const promptPool = [
    'Hva kan du gjøre for å øke psykologisk trygghet denne uken?',
    'Hvilken beslutning trenger teamet klarhet i – og hvordan gir du den?',
    'Hvilke signaler har du ignorert, og hvordan kan du følge dem opp nå?',
    'Hva er én samtale du kan ta for å løfte en medarbeider neste uke?',
    'Hvordan ser en ideell uke ut for teamet – og hva er neste steg dit?',
    'Hva trenger du å delegere for å gi rom til strategisk arbeid?',
    'Hvordan vil du merke at teamet opplever bedre støtte fra deg?',
    'Hvilke eksperimenter bør teamet gjøre for å lære raskere?',
    'Hva kan du gjøre for å tydeliggjøre prioriteringer i dag?',
    'Hvilken relasjon trenger ekstra oppmerksomhet denne uken?',
    'Hva må fjernes for at teamet skal yte sitt beste?',
    'Hvilken beslutning angrer du på at du utsatte, og hvordan tar du den nå?'
];

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const focusForm = $('#focusForm');
const focusInput = $('#dailyFocus');
const focusStatus = $('#focusStatus');
const clearFocusButton = $('#clearFocus');

const pulseForm = $('#pulseForm');
const pulseLog = $('#pulseLog');
const pulseLatest = $('#pulseLatest');
const pulseAverage = $('#pulseAverage');

const priorityForm = $('#priorityForm');
const priorityList = $('#priorityList');
const priorityPreview = $('#priorityPreview');
const priorityProgress = $('#priorityProgress');

const delegationForm = $('#delegationForm');
const delegationList = $('#delegationList');
const delegationSummary = $('#delegationSummary');

const oneOnOneForm = $('#oneOnOneForm');
const oneOnOneList = $('#oneOnOneList');
const oneOnOneSummary = $('#oneOnOneSummary');
const oneOnOneNext = $('#oneOnOneNext');

const decisionForm = $('#decisionForm');
const decisionList = $('#decisionList');
const decisionSummary = $('#decisionSummary');

const adminForm = $('#adminForm');
const adminList = $('#adminList');
const adminSummary = $('#adminSummary');
const adminStatus = $('#adminStatus');

const promptDisplay = $('#promptDisplay');
const promptCurrent = $('#promptCurrent');
const promptFavorites = $('#promptFavorites');
const newPromptButton = $('#newPrompt');
const savePromptButton = $('#savePrompt');

const timelineCanvas = $('#timelineChart');
const timelineModalCanvas = $('#timelineModalChart');
const timelineLog = $('#timelineLog');

const tileButtons = $$('[data-modal-trigger]');
const modalCloseButtons = $$('[data-modal-close]');
const modalWrappers = $$('.modal');
modalWrappers.forEach(modal => {
    modal.classList.add('hidden');
    modalElements.set(modal.dataset.modal, modal);
});

const openModal = (name) => {
    const modal = modalElements.get(name);
    if (!modal) return;
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('active'));
};

const closeModal = (modal) => {
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 180);
};

tileButtons.forEach(trigger => {
    trigger.addEventListener('click', () => openModal(trigger.dataset.modalTrigger));
});

modalCloseButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        const modal = event.currentTarget.closest('.modal');
        if (modal) closeModal(modal);
    });
});

modalWrappers.forEach(modal => {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal(modal);
        }
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        modalWrappers.forEach(modal => {
            if (!modal.classList.contains('hidden')) closeModal(modal);
        });
    }
});

const setFocusStatus = async () => {
    const latest = await db.focus.where('dateKey').equals(todayKey()).last();
    if (latest) {
        focusStatus.textContent = `Dagens fokus: ${latest.text}`;
        focusStatus.classList.remove('empty');
    } else {
        focusStatus.textContent = 'Ingen fokus registrert enda.';
        focusStatus.classList.add('empty');
    }
};

focusForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = focusInput.value.trim();
    if (!text) return;
    await db.focus.add({
        text,
        dateKey: todayKey(),
        createdAt: new Date().toISOString()
    });
    focusInput.value = '';
    await setFocusStatus();
    await refreshTimeline();
});

clearFocusButton.addEventListener('click', async () => {
    await db.focus.where('dateKey').equals(todayKey()).delete();
    await setFocusStatus();
    await refreshTimeline();
});

pulseForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const score = parseInt($('#pulseScore').value, 10);
    const notes = $('#pulseNotes').value.trim();
    const dateInput = $('#pulseDate').value;
    if (!score || !notes) return;
    const timestamp = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();
    await db.pulses.add({
        score,
        notes,
        timestamp
    });
    event.target.reset();
    await renderPulses();
    await refreshTimeline();
});

priorityForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = $('#priorityTitle').value.trim();
    const impact = $('#priorityImpact').value.trim();
    if (!title) return;
    await db.priorities.add({
        title,
        impact,
        completed: false,
        createdAt: new Date().toISOString()
    });
    event.target.reset();
    await renderPriorities();
    await refreshTimeline();
});

delegationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('#delegateName').value.trim();
    const task = $('#delegateTask').value.trim();
    const support = $('#delegateSupport').value.trim();
    if (!name || !task) return;
    await db.delegations.add({
        name,
        task,
        support,
        status: 'aktiv',
        createdAt: new Date().toISOString()
    });
    event.target.reset();
    await renderDelegations();
});

oneOnOneForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('#oneOnOneName').value.trim();
    const date = $('#oneOnOneDate').value;
    const agenda = $('#oneOnOneAgenda').value.trim();
    if (!name || !date) return;
    await db.oneOnOnes.add({
        name,
        date,
        agenda,
        status: 'planlagt',
        createdAt: new Date().toISOString()
    });
    event.target.reset();
    await renderOneOnOnes();
});

decisionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const topic = $('#decisionTopic').value.trim();
    const context = $('#decisionContext').value.trim();
    const outcome = $('#decisionOutcome').value.trim();
    if (!topic) return;
    await db.decisions.add({
        topic,
        context,
        outcome,
        createdAt: new Date().toISOString()
    });
    event.target.reset();
    await renderDecisions();
});

adminForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const task = $('#adminTask').value.trim();
    const due = $('#adminDue').value;
    if (!task) return;
    await db.adminTasks.add({
        task,
        due,
        completed: false,
        createdAt: new Date().toISOString()
    });
    event.target.reset();
    await renderAdmin();
});

const renderPulses = async () => {
    const pulses = await db.pulses.orderBy('timestamp').reverse().limit(25).toArray();
    pulseLog.innerHTML = '';
    pulses.forEach(entry => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${pulseLabels[entry.score] || entry.score}</strong>
            <span>${formatDateTime(entry.timestamp)}</span>
            <p>${entry.notes}</p>
        `;
        pulseLog.appendChild(li);
    });

    if (pulses.length) {
        const latest = pulses[0];
        pulseLatest.textContent = `${pulseLabels[latest.score] || latest.score} – ${latest.notes}`;
    } else {
        pulseLatest.textContent = 'Ingen registreringer';
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const allRecent = await db.pulses.where('timestamp').above(sevenDaysAgo.toISOString()).toArray();
    if (allRecent.length) {
        const avg = allRecent.reduce((sum, item) => sum + item.score, 0) / allRecent.length;
        pulseAverage.textContent = avg.toFixed(1);
    } else {
        pulseAverage.textContent = '–';
    }
};

const renderPriorities = async () => {
    const priorities = await db.priorities.orderBy('createdAt').reverse().toArray();
    priorityList.innerHTML = '';
    priorityPreview.innerHTML = '';

    priorities.forEach(priority => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${priority.title}</strong>
                ${priority.impact ? `<p>${priority.impact}</p>` : ''}
            </div>
            <label class="check-toggle">
                <input type="checkbox" ${priority.completed ? 'checked' : ''}>
                <span>${priority.completed ? 'Fullført' : 'Pågår'}</span>
            </label>
        `;
        const checkbox = li.querySelector('input');
        checkbox.addEventListener('change', async () => {
            await db.priorities.update(priority.id, { completed: checkbox.checked });
            await renderPriorities();
            await refreshTimeline();
        });
        priorityList.appendChild(li);
    });

    priorities.filter(p => !p.completed).slice(0, 3).forEach(priority => {
        const pill = document.createElement('li');
        pill.textContent = priority.title;
        priorityPreview.appendChild(pill);
    });

    if (!priorityPreview.children.length) {
        const pill = document.createElement('li');
        pill.textContent = 'Alt på track – vurder ny satsing';
        priorityPreview.appendChild(pill);
    }

    const total = priorities.length;
    const completed = priorities.filter(p => p.completed).length;
    if (total) {
        const percentage = Math.round((completed / total) * 100);
        priorityProgress.textContent = `${percentage}%`;
    } else {
        priorityProgress.textContent = '–';
    }
};

const renderDelegations = async () => {
    const delegations = await db.delegations.orderBy('createdAt').reverse().toArray();
    delegationList.innerHTML = '';
    delegations.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${item.name}</strong>
                <p>${item.task}</p>
                ${item.support ? `<p class="hint">Støtte: ${item.support}</p>` : ''}
            </div>
            <label class="check-toggle">
                <input type="checkbox" ${item.status === 'fullført' ? 'checked' : ''}>
                <span>${item.status === 'fullført' ? 'Fullført' : 'Følg opp'}</span>
            </label>
        `;
        const checkbox = li.querySelector('input');
        checkbox.addEventListener('change', async () => {
            await db.delegations.update(item.id, { status: checkbox.checked ? 'fullført' : 'aktiv' });
            await renderDelegations();
        });
        delegationList.appendChild(li);
    });

    const active = delegations.filter(item => item.status !== 'fullført');
    if (active.length) {
        delegationSummary.textContent = `${active.length} aktiv${active.length === 1 ? '' : 'e'} plan${active.length === 1 ? '' : 'er'}`;
    } else {
        delegationSummary.textContent = 'Ingen aktive planer';
    }
};

const renderOneOnOnes = async () => {
    const conversations = await db.oneOnOnes.orderBy('date').toArray();
    oneOnOneList.innerHTML = '';
    conversations.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${item.name}</strong>
                <p>${formatDate(item.date, { month: 'long' })}</p>
                ${item.agenda ? `<p class="hint">${item.agenda}</p>` : ''}
            </div>
            <label class="check-toggle">
                <input type="checkbox" ${item.status === 'gjennomført' ? 'checked' : ''}>
                <span>${item.status === 'gjennomført' ? 'Gjennomført' : 'Planlagt'}</span>
            </label>
        `;
        const checkbox = li.querySelector('input');
        checkbox.addEventListener('change', async () => {
            await db.oneOnOnes.update(item.id, { status: checkbox.checked ? 'gjennomført' : 'planlagt' });
            await renderOneOnOnes();
        });
        oneOnOneList.appendChild(li);
    });

    const upcoming = conversations.find(item => new Date(item.date) >= new Date());
    if (upcoming) {
        oneOnOneSummary.textContent = `${upcoming.name} – ${formatDate(upcoming.date)}`;
        oneOnOneNext.textContent = formatDate(upcoming.date, { month: 'short' });
    } else if (conversations.length) {
        const last = conversations[conversations.length - 1];
        oneOnOneSummary.textContent = `${last.name} – ${formatDate(last.date)}`;
        oneOnOneNext.textContent = 'Planlegg ny';
    } else {
        oneOnOneSummary.textContent = 'Ingen planlagte samtaler';
        oneOnOneNext.textContent = '–';
    }
};

const renderDecisions = async () => {
    const decisions = await db.decisions.orderBy('createdAt').reverse().toArray();
    decisionList.innerHTML = '';
    decisions.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${item.topic}</strong>
                <span>${formatDateTime(item.createdAt)}</span>
                ${item.context ? `<p>${item.context}</p>` : ''}
                ${item.outcome ? `<p class="hint">Neste steg: ${item.outcome}</p>` : ''}
            </div>
        `;
        decisionList.appendChild(li);
    });

    if (decisions.length) {
        const latest = decisions[0];
        decisionSummary.textContent = `${latest.topic} – ${formatDate(latest.createdAt)}`;
    } else {
        decisionSummary.textContent = 'Ingen beslutninger logget';
    }
};

const renderAdmin = async () => {
    const tasks = await db.adminTasks.orderBy('createdAt').reverse().toArray();
    adminList.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${task.task}</strong>
                ${task.due ? `<span>Frist: ${formatDate(task.due)}</span>` : ''}
            </div>
            <label class="check-toggle">
                <input type="checkbox" ${task.completed ? 'checked' : ''}>
                <span>${task.completed ? 'Fullført' : 'Åpen'}</span>
            </label>
        `;
        const checkbox = li.querySelector('input');
        checkbox.addEventListener('change', async () => {
            await db.adminTasks.update(task.id, { completed: checkbox.checked });
            await renderAdmin();
        });
        adminList.appendChild(li);
    });

    const openCount = tasks.filter(task => !task.completed).length;
    adminSummary.textContent = openCount ? `${openCount} åpen${openCount === 1 ? '' : 'e'} oppgave${openCount === 1 ? '' : 'r'}` : 'Ingen åpne oppgaver';
    adminStatus.textContent = openCount ? `${openCount} åpne` : 'På plass';
};

const refreshPrompts = async () => {
    const favorites = await db.favorites.toArray();
    promptFavorites.innerHTML = '';
    favorites.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <p>${item.text}</p>
            </div>
            <button class="secondary">Fjern</button>
        `;
        const button = li.querySelector('button');
        button.addEventListener('click', async () => {
            await db.favorites.delete(item.id);
            await refreshPrompts();
        });
        promptFavorites.appendChild(li);
    });
};

const pickPrompt = () => {
    const next = promptPool[Math.floor(Math.random() * promptPool.length)];
    promptDisplay.textContent = `«${next}»`;
    promptCurrent.textContent = `«${next}»`;
    savePromptButton.dataset.prompt = next;
};

newPromptButton.addEventListener('click', () => {
    pickPrompt();
});

savePromptButton.addEventListener('click', async () => {
    const text = savePromptButton.dataset.prompt;
    if (!text) return;
    const existing = await db.favorites.where('text').equals(text).first();
    if (existing) return;
    await db.favorites.add({ text, createdAt: new Date().toISOString() });
    await refreshPrompts();
});

const initCharts = () => {
    if (!timelineCanvas || !timelineModalCanvas) return;
    const baseConfig = {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Team-puls',
                    data: [],
                    borderColor: 'rgba(129, 241, 220, 0.85)',
                    backgroundColor: 'rgba(129, 241, 220, 0.25)',
                    tension: 0.35,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Prioritetsprogresjon',
                    data: [],
                    borderColor: 'rgba(91, 192, 248, 0.9)',
                    backgroundColor: 'rgba(91, 192, 248, 0.18)',
                    tension: 0.35,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: 5,
                    ticks: { color: 'rgba(255,255,255,0.7)' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                y1: {
                    beginAtZero: true,
                    suggestedMax: 100,
                    position: 'right',
                    ticks: { color: 'rgba(255,255,255,0.6)', callback: value => `${value}%` },
                    grid: { drawOnChartArea: false }
                },
                x: {
                    ticks: { color: 'rgba(255,255,255,0.6)' },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: 'rgba(255,255,255,0.8)' }
                }
            }
        }
    };

    timelineChart = new Chart(timelineCanvas, JSON.parse(JSON.stringify(baseConfig)));
    timelineModalChart = new Chart(timelineModalCanvas, JSON.parse(JSON.stringify(baseConfig)));
};

const refreshTimeline = async () => {
    const pulses = await db.pulses.orderBy('timestamp').toArray();
    const priorities = await db.priorities.toArray();
    const focusEntries = await db.focus.toArray();

    const timelineMap = new Map();

    pulses.forEach(entry => {
        const key = entry.timestamp.slice(0, 10);
        const group = timelineMap.get(key) || { scores: [], focus: false };
        group.scores.push(entry.score);
        timelineMap.set(key, group);
    });

    focusEntries.forEach(entry => {
        const group = timelineMap.get(entry.dateKey) || { scores: [], focus: false };
        group.focus = true;
        timelineMap.set(entry.dateKey, group);
    });

    const totalPriorities = priorities.length;
    const completedPriorities = priorities.filter(p => p.completed).length;
    const completionPercent = totalPriorities ? Math.round((completedPriorities / totalPriorities) * 100) : 0;

    const sortedDates = Array.from(timelineMap.keys()).sort();
    const labels = [];
    const pulseSeries = [];
    const prioritySeries = [];

    timelineLog.innerHTML = '';

    sortedDates.forEach(dateKey => {
        const group = timelineMap.get(dateKey);
        const avg = group.scores.length ? (group.scores.reduce((sum, value) => sum + value, 0) / group.scores.length) : null;
        labels.push(formatDate(dateKey));
        pulseSeries.push(avg ? Number(avg.toFixed(2)) : null);
        prioritySeries.push(completionPercent);

        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${formatDate(dateKey)}</strong>
            <span>${avg ? `Puls: ${avg.toFixed(1)}` : 'Ingen pulsregistrering'}</span>
            <span>${group.focus ? 'Fokus forankret' : 'Fokus ikke satt'}</span>
            <span>Prioritetsprogresjon: ${completionPercent}%</span>
        `;
        timelineLog.appendChild(li);
    });

    if (!labels.length) {
        labels.push(formatDate(todayKey()));
        pulseSeries.push(null);
        prioritySeries.push(completionPercent);

        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${formatDate(todayKey())}</strong>
            <span>Ingen registreringer enda – start med puls eller fokus.</span>
            <span>Prioritetsprogresjon: ${completionPercent}%</span>
        `;
        timelineLog.appendChild(li);
    }

    const updateChart = (chart) => {
        chart.data.labels = labels;
        chart.data.datasets[0].data = pulseSeries;
        chart.data.datasets[1].data = prioritySeries;
        chart.update();
    };

    if (timelineChart && timelineModalChart) {
        updateChart(timelineChart);
        updateChart(timelineModalChart);
    }
};

const bootstrap = async () => {
    await db.open();
    await setFocusStatus();
    pickPrompt();
    await refreshPrompts();
    await renderPulses();
    await renderPriorities();
    await renderDelegations();
    await renderOneOnOnes();
    await renderDecisions();
    await renderAdmin();
    initCharts();
    await refreshTimeline();
};

bootstrap();
