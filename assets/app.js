const storage = {
    get(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            console.error('Kunne ikke hente data', error);
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Kunne ikke lagre data', error);
        }
    }
};

const formatDateTime = (date = new Date()) => {
    return new Intl.DateTimeFormat('no-NO', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(date);
};

const state = {
    focus: storage.get('dailyFocus', ''),
    pulse: storage.get('pulseLog', []),
    priorities: storage.get('priorityList', []),
    delegations: storage.get('delegationList', []),
    oneOnOnes: storage.get('oneOnOneList', []),
    decisions: storage.get('decisionList', []),
    admin: storage.get('adminList', [])
};

const dailyFocusInput = document.getElementById('dailyFocus');
const saveFocusButton = document.getElementById('saveFocus');
const pulseForm = document.getElementById('pulseForm');
const pulseLog = document.getElementById('pulseLog');
const priorityForm = document.getElementById('priorityForm');
const priorityList = document.getElementById('priorityList');
const delegationForm = document.getElementById('delegationForm');
const delegationList = document.getElementById('delegationList');
const oneOnOneForm = document.getElementById('oneOnOneForm');
const oneOnOneList = document.getElementById('oneOnOneList');
const decisionForm = document.getElementById('decisionForm');
const decisionList = document.getElementById('decisionList');
const adminForm = document.getElementById('adminForm');
const adminList = document.getElementById('adminList');
const newPromptButton = document.getElementById('newPrompt');
const promptList = document.getElementById('promptList');

const prompts = [
    'Hva må til for at du skal kjenne deg trygg i denne beslutningen?',
    'Hvilke styrker hos teamet kan vi bruke mer av her?',
    'Hva ville være en minimal test for å validere antakelsene våre?',
    'Hva kan du delegere for å skape utvikling hos andre?',
    'Hva ville være et modig neste steg?'
];

const renderers = {
    pulse(entries) {
        pulseLog.innerHTML = entries
            .map(entry => `
                <li class="log-item">
                    <header>
                        <strong>${entry.scoreLabel}</strong>
                        <time>${entry.time}</time>
                    </header>
                    ${entry.notes ? `<p>${entry.notes}</p>` : ''}
                </li>
            `)
            .join('');
    },
    priorities(items) {
        priorityList.innerHTML = items
            .map((item, index) => `
                <li class="checklist-item">
                    <input type="checkbox" data-index="${index}" ${item.done ? 'checked' : ''}>
                    <div>
                        <label>${item.title}</label>
                        ${item.impact ? `<small>Effekt: ${item.impact}</small>` : ''}
                    </div>
                </li>
            `)
            .join('');
    },
    delegations(items) {
        delegationList.innerHTML = items
            .map(item => `
                <li class="log-item">
                    <header>
                        <strong>${item.person}</strong>
                        <time>${item.time}</time>
                    </header>
                    <p>Oppgave: ${item.task}</p>
                    ${item.support ? `<p>Støtte: ${item.support}</p>` : ''}
                </li>
            `)
            .join('');
    },
    oneOnOnes(items) {
        oneOnOneList.innerHTML = items
            .map(item => `
                <li class="log-item">
                    <header>
                        <strong>${item.person}</strong>
                        <time>${item.date}</time>
                    </header>
                    ${item.agenda ? `<p>${item.agenda}</p>` : ''}
                </li>
            `)
            .join('');
    },
    decisions(items) {
        decisionList.innerHTML = items
            .map(item => `
                <li class="log-item">
                    <header>
                        <strong>${item.topic}</strong>
                        <time>${item.time}</time>
                    </header>
                    ${item.context ? `<p>Kontekst: ${item.context}</p>` : ''}
                    ${item.outcome ? `<p>Neste steg: ${item.outcome}</p>` : ''}
                </li>
            `)
            .join('');
    },
    admin(items) {
        adminList.innerHTML = items
            .map((item, index) => `
                <li class="checklist-item">
                    <input type="checkbox" data-index="${index}" ${item.done ? 'checked' : ''}>
                    <div>
                        <label>${item.title}</label>
                        ${item.due ? `<small>Frist: ${item.due}</small>` : ''}
                    </div>
                </li>
            `)
            .join('');
    }
};

const scoreLabels = {
    '1': 'Lav – bekymret',
    '2': 'Middels – urolig',
    '3': 'Stabil',
    '4': 'God',
    '5': 'Strålende'
};

const init = () => {
    dailyFocusInput.value = state.focus;
    renderers.pulse(state.pulse);
    renderers.priorities(state.priorities);
    renderers.delegations(state.delegations);
    renderers.oneOnOnes(state.oneOnOnes);
    renderers.decisions(state.decisions);
    renderers.admin(state.admin);
};

saveFocusButton.addEventListener('click', () => {
    state.focus = dailyFocusInput.value.trim();
    storage.set('dailyFocus', state.focus);
    saveFocusButton.textContent = 'Lagret!';
    saveFocusButton.disabled = true;
    setTimeout(() => {
        saveFocusButton.textContent = 'Lagre';
        saveFocusButton.disabled = false;
    }, 1500);
});

pulseForm.addEventListener('submit', event => {
    event.preventDefault();
    const score = document.getElementById('pulseScore').value;
    if (!score) return;
    const notes = document.getElementById('pulseNotes').value.trim();
    const entry = {
        score,
        scoreLabel: scoreLabels[score] ?? `Nivå ${score}`,
        notes,
        time: formatDateTime()
    };
    state.pulse = [entry, ...state.pulse].slice(0, 10);
    storage.set('pulseLog', state.pulse);
    renderers.pulse(state.pulse);
    pulseForm.reset();
});

priorityForm.addEventListener('submit', event => {
    event.preventDefault();
    const title = document.getElementById('priorityTitle').value.trim();
    if (!title) return;
    const impact = document.getElementById('priorityImpact').value.trim();
    state.priorities = [
        { title, impact, done: false },
        ...state.priorities
    ];
    storage.set('priorityList', state.priorities);
    renderers.priorities(state.priorities);
    priorityForm.reset();
});

priorityList.addEventListener('change', event => {
    if (event.target.matches('input[type="checkbox"]')) {
        const index = Number(event.target.dataset.index);
        state.priorities[index].done = event.target.checked;
        storage.set('priorityList', state.priorities);
    }
});

delegationForm.addEventListener('submit', event => {
    event.preventDefault();
    const person = document.getElementById('delegateName').value.trim();
    const task = document.getElementById('delegateTask').value.trim();
    if (!person || !task) return;
    const support = document.getElementById('delegateSupport').value.trim();
    const entry = {
        person,
        task,
        support,
        time: formatDateTime()
    };
    state.delegations = [entry, ...state.delegations].slice(0, 10);
    storage.set('delegationList', state.delegations);
    renderers.delegations(state.delegations);
    delegationForm.reset();
});

oneOnOneForm.addEventListener('submit', event => {
    event.preventDefault();
    const person = document.getElementById('oneOnOneName').value.trim();
    const date = document.getElementById('oneOnOneDate').value;
    if (!person || !date) return;
    const agenda = document.getElementById('oneOnOneAgenda').value.trim();
    const entry = {
        person,
        date: new Intl.DateTimeFormat('no-NO', {
            dateStyle: 'medium'
        }).format(new Date(date)),
        agenda
    };
    state.oneOnOnes = [entry, ...state.oneOnOnes].slice(0, 10);
    storage.set('oneOnOneList', state.oneOnOnes);
    renderers.oneOnOnes(state.oneOnOnes);
    oneOnOneForm.reset();
});

decisionForm.addEventListener('submit', event => {
    event.preventDefault();
    const topic = document.getElementById('decisionTopic').value.trim();
    if (!topic) return;
    const context = document.getElementById('decisionContext').value.trim();
    const outcome = document.getElementById('decisionOutcome').value.trim();
    const entry = {
        topic,
        context,
        outcome,
        time: formatDateTime()
    };
    state.decisions = [entry, ...state.decisions].slice(0, 15);
    storage.set('decisionList', state.decisions);
    renderers.decisions(state.decisions);
    decisionForm.reset();
});

adminForm.addEventListener('submit', event => {
    event.preventDefault();
    const title = document.getElementById('adminTask').value.trim();
    if (!title) return;
    const due = document.getElementById('adminDue').value;
    state.admin = [
        {
            title,
            due: due ? new Intl.DateTimeFormat('no-NO', { dateStyle: 'medium' }).format(new Date(due)) : '',
            done: false
        },
        ...state.admin
    ];
    storage.set('adminList', state.admin);
    renderers.admin(state.admin);
    adminForm.reset();
});

adminList.addEventListener('change', event => {
    if (event.target.matches('input[type="checkbox"]')) {
        const index = Number(event.target.dataset.index);
        state.admin[index].done = event.target.checked;
        storage.set('adminList', state.admin);
    }
});

newPromptButton.addEventListener('click', () => {
    const existingPrompts = Array.from(promptList.querySelectorAll('li')).map(li => li.textContent);
    let candidate = prompts[Math.floor(Math.random() * prompts.length)];
    let tries = 0;
    while (existingPrompts.includes(candidate) && tries < prompts.length) {
        candidate = prompts[Math.floor(Math.random() * prompts.length)];
        tries += 1;
    }
    if (!existingPrompts.includes(candidate)) {
        const item = document.createElement('li');
        item.textContent = candidate;
        promptList.appendChild(item);
    }
});

init();
