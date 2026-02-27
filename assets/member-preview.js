(function (global) {
  const MEMBER_KEY = 'di_member_preview_v1';
  const EVENT_KEY = 'di_download_events_v1';

  function safeParse(input) {
    try {
      return JSON.parse(input);
    } catch (error) {
      return null;
    }
  }

  function readMember() {
    const raw = global.localStorage.getItem(MEMBER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = safeParse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  }

  function saveMember(member) {
    if (!member || typeof member !== 'object') {
      return;
    }
    const normalized = {
      uid: member.uid || 'preview-' + Math.random().toString(36).slice(2, 10),
      email: String(member.email || '').trim().toLowerCase(),
      plan: String(member.plan || 'starter').toLowerCase(),
      status: String(member.status || 'active').toLowerCase(),
      track: String(member.track || 'Foundations'),
      createdAt: member.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    global.localStorage.setItem(MEMBER_KEY, JSON.stringify(normalized));
  }

  function clearMember() {
    global.localStorage.removeItem(MEMBER_KEY);
  }

  function planWeight(plan) {
    return {
      starter: 1,
      research: 2,
      patron: 3
    }[String(plan || '').toLowerCase()] || 0;
  }

  function canAccess(member, requiredPlan) {
    if (!member || member.status !== 'active') {
      return false;
    }
    return planWeight(member.plan) >= planWeight(requiredPlan);
  }

  function readEvents() {
    const raw = global.localStorage.getItem(EVENT_KEY);
    const parsed = raw ? safeParse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  }

  function recordDownloadEvent(event) {
    const events = readEvents();
    const payload = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      createdAt: new Date().toISOString(),
      ...event
    };
    events.unshift(payload);
    global.localStorage.setItem(EVENT_KEY, JSON.stringify(events.slice(0, 500)));
  }

  global.DonutMember = {
    readMember,
    saveMember,
    clearMember,
    canAccess,
    planWeight,
    readEvents,
    recordDownloadEvent
  };
})(window);
