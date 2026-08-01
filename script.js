(function () {
  const currentYearElement = document.getElementById('current-year');
  const playerCountElement = document.getElementById('player-count');
  const scrollTopButton = document.getElementById('scroll-top');
  const scrollProgress = document.getElementById('scroll-progress');
  const discordLoginButton = document.getElementById('discord-login-btn');
  const guidesLink = document.getElementById('guides-link');
  const antiInspectState = {
    triggered: false,
    reloadTimer: null,
  };

  const isLocalPreview = window.location.protocol === 'file:' || ['127.0.0.1', 'localhost'].includes(window.location.hostname);
  const staffApiBase = isLocalPreview ? 'http://127.0.0.1:3001' : '/.netlify/functions/staff-applications';
  const discordAuthBase = isLocalPreview ? 'http://127.0.0.1:3001/.netlify/functions/discord-auth' : '/.netlify/functions/discord-auth';

  let lastViewportSnapshot = null;
  let devtoolsProbeCount = 0;
  let devtoolsProbeActive = false;
  let devtoolsProbeStart = 0;
  let devtoolsOpen = false;
  let guideAccessRefreshTimer = null;
  let guideAccessRequestVersion = 0;
  const guideAccessStorageKey = 'guide-access-granted';
  const guideAccessCacheTtlMs = 30000;

  function init() {
    if (currentYearElement) {
      currentYearElement.textContent = new Date().getFullYear();
    }

    async function fetchPlayerCount() {
      if (!playerCountElement) return;
      try {
        const response = await fetch('https://games.roproxy.com/v1/games?universeIds=10267506525');
        if (!response.ok) {
          playerCountElement.textContent = '0';
          return;
        }

        const data = await response.json();
        const count = data.data?.[0]?.playing ?? 0;
        playerCountElement.textContent = count.toLocaleString();
      } catch (error) {
        console.error('Player count fetch failed', error);
        if (playerCountElement) {
          playerCountElement.textContent = '0';
        }
      }
    }

    function showProtectionMessage(reason) {
      if (antiInspectState.triggered) return;

      antiInspectState.triggered = true;
      const overlay = document.createElement('div');
      overlay.id = 'lock-overlay';
      overlay.className = 'anti-lock-overlay';
      overlay.innerHTML = `<div class="lock-box"><p>Protected view</p><strong>${reason}</strong><p>Closing shortly…</p></div>`;
      document.body.appendChild(overlay);
      document.body.classList.add('locked', 'no-select', 'protected');
      document.documentElement.classList.add('protected');
      antiInspectState.reloadTimer = window.setTimeout(() => {
        window.location.replace('about:blank');
      }, 700);
    }

    function evaluateDevtoolsSignals() {
      if (antiInspectState.triggered) return;

      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      const viewportChanged = lastViewportSnapshot
        ? Math.abs(window.innerWidth - lastViewportSnapshot.innerWidth) > 8 ||
          Math.abs(window.innerHeight - lastViewportSnapshot.innerHeight) > 8 ||
          Math.abs(widthGap - lastViewportSnapshot.widthGap) > 4 ||
          Math.abs(heightGap - lastViewportSnapshot.heightGap) > 4
        : false;

      if (viewportChanged && (widthGap > 80 || heightGap > 80)) {
        devtoolsOpen = true;
        window.location.replace('about:blank');
        return;
      }

      lastViewportSnapshot = { innerWidth: window.innerWidth, innerHeight: window.innerHeight, widthGap, heightGap };
    }

    function probeDebuggerPause() {
      if (antiInspectState.triggered || devtoolsProbeActive) return;

      devtoolsProbeActive = true;
      devtoolsProbeCount += 1;
      devtoolsProbeStart = performance.now();

      try {
        debugger;
      } catch (error) {
        // ignore
      }

      const elapsed = performance.now() - devtoolsProbeStart;
      if (elapsed > 220) {
        devtoolsOpen = true;
        window.location.replace('about:blank');
      }

      window.setTimeout(() => {
        devtoolsProbeActive = false;
      }, 1800);
    }

    function installScrollProgress() {
      const updateScrollProgress = () => {
        const scrollTop = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
        if (scrollProgress) {
          scrollProgress.style.width = `${progress}%`;
        }
        if (scrollTopButton) {
          scrollTopButton.classList.toggle('visible', scrollTop > 600);
        }
      };

      window.addEventListener('scroll', updateScrollProgress, { passive: true });
      updateScrollProgress();
    }

    function installMotionEffects() {
      const cards = document.querySelectorAll('.tilt-card');

      cards.forEach((card) => {
        card.addEventListener('mousemove', (event) => {
          const rect = card.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const rotateY = ((x / rect.width) - 0.5) * 16;
          const rotateX = ((y / rect.height) - 0.5) * -10;
          card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
          card.style.setProperty('--mouse-x', `${x}px`);
          card.style.setProperty('--mouse-y', `${y}px`);
          card.style.setProperty('--glow-opacity', '0.28');
        });

        card.addEventListener('mouseleave', () => {
          card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
          card.style.setProperty('--glow-opacity', '0');
        });
      });

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.16 });

      document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
    }

    function installCounterAnimations() {
      document.querySelectorAll('[data-count]').forEach((element) => {
        const target = Number(element.getAttribute('data-count')) || 0;
        const duration = 1200;
        const startTime = performance.now();

        function tick(now) {
          const progress = Math.min((now - startTime) / duration, 1);
          const value = Math.round(target * progress);
          element.textContent = `${value}%`;
          if (progress < 1) {
            requestAnimationFrame(tick);
          }
        }

        requestAnimationFrame(tick);
      });
    }

    function installFaqAccordion() {
      document.querySelectorAll('.faq-item').forEach((item) => {
        item.addEventListener('toggle', () => {
          if (!item.open) return;
          document.querySelectorAll('.faq-item').forEach((other) => {
            if (other !== item) other.open = false;
          });
        });
      });
    }

    function installBackgroundCanvas() {
      const canvas = document.getElementById('background-canvas');
      if (!canvas) return;
      canvas.remove();
    }

    function parseDiscordHashProfile() {
      if (!window.location.hash) return null;
      const match = window.location.hash.match(/#discord-login=(.+)$/);
      if (!match || !match[1]) return null;

      try {
        return JSON.parse(decodeURIComponent(match[1]));
      } catch (error) {
        return null;
      }
    }

    function buildStaffApiUrl(action, applicationId) {
      if (isLocalPreview) {
        switch (action) {
          case 'submit': return `${staffApiBase}/staff-application`;
          case 'list': return `${staffApiBase}/staff-applications`;
          case 'delete': return `${staffApiBase}/staff-applications/${encodeURIComponent(applicationId)}/delete`;
          case 'download': return `${staffApiBase}/staff-applications/${encodeURIComponent(applicationId)}/download`;
          default: return staffApiBase;
        }
      }

      const params = new URLSearchParams({ action });
      if (applicationId) params.set('id', applicationId);
      return `${staffApiBase}?${params.toString()}`;
    }

    function readStoredGuideAccessState() {
      try {
        const stored = localStorage.getItem(guideAccessStorageKey);
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
      } catch (error) {
        return null;
      }
    }

    function persistGuideAccessState(isVisible) {
      try {
        const payload = {
          granted: isVisible,
          timestamp: Date.now(),
        };
        localStorage.setItem(guideAccessStorageKey, JSON.stringify(payload));
      } catch (error) {
        // ignore storage errors
      }
    }

    function applyGuideLinkVisibility(isVisible) {
      if (!guidesLink) return;
      guidesLink.hidden = !isVisible;
      if (isVisible) {
        guidesLink.removeAttribute('hidden');
      } else {
        guidesLink.setAttribute('hidden', '');
      }
    }

    async function evaluateGuideAccess(profile) {
      if (!guidesLink) return;
      const requestVersion = ++guideAccessRequestVersion;

      if (!profile?.accessToken) {
        persistGuideAccessState(false);
        applyGuideLinkVisibility(false);
        return;
      }

      const cachedState = readStoredGuideAccessState();
      const isCacheFresh = cachedState && Date.now() - cachedState.timestamp < guideAccessCacheTtlMs;
      if (cachedState?.granted && isCacheFresh) {
        applyGuideLinkVisibility(true);
        return;
      }

      applyGuideLinkVisibility(false);

      try {
        const response = await fetch(buildStaffApiUrl('list'), {
          headers: {
            Authorization: `Bearer ${profile.accessToken}`,
          },
        });

        if (requestVersion !== guideAccessRequestVersion) {
          return;
        }

        if (!response.ok) {
          persistGuideAccessState(false);
          applyGuideLinkVisibility(false);
          return;
        }

        const data = await response.json().catch(() => null);

        if (requestVersion !== guideAccessRequestVersion) {
          return;
        }

        const isAllowed = data?.ok === true || response.status === 200;
        persistGuideAccessState(isAllowed);
        applyGuideLinkVisibility(isAllowed);
      } catch (error) {
        if (requestVersion === guideAccessRequestVersion) {
          const fallbackState = readStoredGuideAccessState();
          if (fallbackState?.granted && Date.now() - fallbackState.timestamp < guideAccessCacheTtlMs) {
            applyGuideLinkVisibility(true);
          } else {
            persistGuideAccessState(false);
            applyGuideLinkVisibility(false);
          }
        }
      }
    }

    function getStoredDiscordAuth() {
      try {
        const stored = JSON.parse(localStorage.getItem('discord-auth') || 'null');
        if (stored && stored.username && stored.accessToken) return stored;
      } catch (error) {
        // ignore
      }

      try {
        const legacy = JSON.parse(localStorage.getItem('discord-profile') || 'null');
        if (legacy && legacy.username && legacy.accessToken) return legacy;
      } catch (error) {
        // ignore
      }

      return null;
    }

    function storeDiscordAuth(payload) {
      try {
        localStorage.setItem('discord-auth', JSON.stringify(payload));
      } catch (error) {
        console.error('Unable to save Discord auth', error);
      }
    }

    function getDiscordAvatarUrl(profile) {
      if (!profile) return '';
      if (profile.avatar) {
        return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=128`;
      }
      const fallbackIndex = Number(profile.discriminator || 0) % 5;
      return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
    }

    const OWNER_ROLE_ID = '1514092090898911292';
    const OWNER_GUILD_ID = '1514091591508168765';
    const OWNER_USER_ID = '1240030757779538030';

    async function hasOwnerRole(profile) {
      if (!profile?.id) return false;

      if (profile.id === OWNER_USER_ID) return true;

      if (!profile?.accessToken) return false;

      try {
        const response = await fetch(`https://discord.com/api/guilds/${OWNER_GUILD_ID}/members/${profile.id}`, {
          headers: {
            Authorization: `Bearer ${profile.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) return false;

        const member = await response.json();
        return Array.isArray(member?.roles) && member.roles.includes(OWNER_ROLE_ID);
      } catch (error) {
        return false;
      }
    }

    async function renderDiscordProfile(profile) {
      if (!discordLoginButton) return;
      if (!profile?.username) {
        discordLoginButton.innerHTML = 'Discord Login';
        discordLoginButton.disabled = false;
        discordLoginButton.classList.remove('profile-mode');
        return;
      }

      const avatarUrl = getDiscordAvatarUrl(profile);
      const showOwnerCrown = await hasOwnerRole(profile);
      discordLoginButton.classList.add('profile-mode');
      discordLoginButton.disabled = true;
      const crownMarkup = showOwnerCrown
        ? '<img class="owner-crown" src="images/randomimages/982066-crow.png" alt="Owner crown" />'
        : '';

      discordLoginButton.innerHTML = `
        <img class="discord-avatar" src="${avatarUrl}" alt="${profile.username} avatar" />
        <span class="discord-profile-text">${crownMarkup}${profile.username}#${profile.discriminator || '0000'}</span>
      `;
    }

    async function refreshDiscordUi(profile = getStoredDiscordAuth()) {
      await renderDiscordProfile(profile);
      evaluateGuideAccess(profile);
    }

    function installDiscordLogin() {
      if (!discordLoginButton) return;

      const profileFromHash = parseDiscordHashProfile();
      if (profileFromHash) {
        storeDiscordAuth(profileFromHash);
        window.location.hash = '';
      }

      const profile = getStoredDiscordAuth();
      refreshDiscordUi(profile);

      const refreshGuideAccess = () => {
        const currentProfile = getStoredDiscordAuth();
        refreshDiscordUi(currentProfile);
      };

      window.addEventListener('pageshow', refreshGuideAccess);
      window.addEventListener('focus', refreshGuideAccess);
      window.addEventListener('storage', refreshGuideAccess);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          refreshGuideAccess();
        }
      });

      if (guideAccessRefreshTimer) {
        window.clearTimeout(guideAccessRefreshTimer);
      }
      guideAccessRefreshTimer = window.setTimeout(refreshGuideAccess, 1800);

      discordLoginButton.addEventListener('click', () => {
        const storedProfile = getStoredDiscordAuth();
        if (storedProfile?.username && storedProfile?.accessToken) {
          renderDiscordProfile(storedProfile);
          return;
        }

        const returnTo = window.location.origin;
        const authUrl = `${discordAuthBase}?mode=login&return_to=${encodeURIComponent(returnTo)}`;

        let popup = null;
        try {
          popup = window.open(authUrl, 'discord-login', 'width=560,height=720');
        } catch (error) {
          popup = null;
        }

        if (!popup) {
          window.location.assign(authUrl);
          return;
        }

        const handleMessage = (event) => {
          const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (!payload || typeof payload !== 'object' || !payload.id) return;
          storeDiscordAuth(payload);
          refreshDiscordUi(payload);
          window.dispatchEvent(new CustomEvent('discord-auth-updated', { detail: payload }));
          window.removeEventListener('message', handleMessage);
        };

        window.addEventListener('message', handleMessage, { once: true });
      });
    }

    function setupStaffApplicationPage() {
      const staffForm = document.getElementById('staff-application-form');
      const staffApplicationsList = document.getElementById('staff-applications-list');
      const staffApplicationsPagination = document.getElementById('staff-applications-pagination');
      const staffApplicationDetails = document.getElementById('staff-application-details');
      const responsesToggle = document.getElementById('staff-applications-toggle');
      const accessMessage = document.getElementById('staff-application-access-message');
      const staffFeedback = document.getElementById('staff-application-feedback');
      const discordUsernameField = document.getElementById('discord-username');
      const pageSize = 5;
      let applicationsCache = [];
      let currentPage = 1;

      async function parseApiResponse(response) {
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch (error) {
          return { error: `Invalid JSON response: ${text.slice(0, 300)}` };
        }
      }

      const getCurrentProfile = () => getStoredDiscordAuth();

      function escapeHtml(value) {
        return String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function updateDiscordUsernameField() {
        const profile = getCurrentProfile();
        if (discordUsernameField && profile?.username) {
          discordUsernameField.value = `${profile.username}#${profile.discriminator || '0000'}`;
        }
      }

      function showApplicationDetails(application) {
        if (!staffApplicationDetails) return;
        staffApplicationDetails.innerHTML = `
          <div class="application-details-card">
            <h5>${escapeHtml(application.discordUsername || 'Unknown Discord user')}</h5>
            <div class="application-detail-item">
              <span class="application-detail-label">Roblox username</span>
              <span class="application-detail-value">${escapeHtml(application.robloxUsername || 'Unknown')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">Over 13</span>
              <span class="application-detail-value">${escapeHtml(application.over13 || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">Time zone</span>
              <span class="application-detail-value">${escapeHtml(application.timeZone || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">Microphone</span>
              <span class="application-detail-value">${escapeHtml(application.microphone || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">E- bypass</span>
              <span class="application-detail-value">${escapeHtml(application.eBypass || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">Admin abuse</span>
              <span class="application-detail-value">${escapeHtml(application.adminAbuse || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">Harassment</span>
              <span class="application-detail-value">${escapeHtml(application.harassment || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">Exploiting</span>
              <span class="application-detail-value">${escapeHtml(application.exploiting || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">NSFW</span>
              <span class="application-detail-value">${escapeHtml(application.nsfw || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">Avoid punishment</span>
              <span class="application-detail-value">${escapeHtml(application.avoidPunishment || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">Filter bypass</span>
              <span class="application-detail-value">${escapeHtml(application.filterBypass || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">Disruptive</span>
              <span class="application-detail-value">${escapeHtml(application.disruptive || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">Racist</span>
              <span class="application-detail-value">${escapeHtml(application.racist || 'Not provided')}</span>
            </div>
            <div class="application-detail-item">
              <span class="application-detail-label">Online dating</span>
              <span class="application-detail-value">${escapeHtml(application.onlineDating || 'Not provided')}</span>
            </div>
            <div class="application-detail-actions">
              <button class="btn btn-secondary responses-toggle" type="button" data-action="back-to-list">Back to responses</button>
              <button class="btn btn-secondary" type="button" data-action="download-application">Download response</button>
              <button class="btn btn-secondary" type="button" data-action="delete-application">Delete response</button>
            </div>
          </div>
        `;
        staffApplicationsList.hidden = true;
        staffApplicationsPagination.hidden = true;
        staffApplicationDetails.hidden = false;
        staffApplicationDetails.querySelector('[data-action="back-to-list"]')?.addEventListener('click', () => {
          staffApplicationDetails.hidden = true;
          staffApplicationsList.hidden = false;
          staffApplicationsPagination.hidden = false;
          renderApplicationsPage(currentPage);
        });
        staffApplicationDetails.querySelector('[data-action="download-application"]')?.addEventListener('click', async () => {
          const profile = getCurrentProfile();
          if (!profile?.accessToken) return;

          const response = await fetch(buildStaffApiUrl('download', application.id), {
            headers: {
              Authorization: `Bearer ${profile.accessToken}`,
            },
          });

          if (!response.ok) return;

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `application-${application.id}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        });
        staffApplicationDetails.querySelector('[data-action="delete-application"]')?.addEventListener('click', async () => {
          const profile = getCurrentProfile();
          if (!profile?.accessToken) return;

          const response = await fetch(buildStaffApiUrl('delete', application.id), {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${profile.accessToken}`,
            },
          });

          if (!response.ok) return;

          applicationsCache = applicationsCache.filter((item) => item.id !== application.id);
          renderApplicationsPage(Math.max(1, currentPage));
        });
      }

      function renderApplicationsPage(page = 1) {
        if (!staffApplicationsList || !staffApplicationsPagination || !staffApplicationDetails) return;
        const totalPages = Math.max(1, Math.ceil(applicationsCache.length / pageSize));
        currentPage = Math.min(Math.max(page, 1), totalPages);

        if (!applicationsCache.length) {
          staffApplicationsList.innerHTML = '<p>No applications found.</p>';
          staffApplicationsPagination.innerHTML = '';
          staffApplicationsPagination.hidden = true;
          staffApplicationsList.hidden = false;
          staffApplicationDetails.hidden = true;
          return;
        }

        const start = (currentPage - 1) * pageSize;
        const visibleApplications = applicationsCache.slice(start, start + pageSize);
        staffApplicationsList.innerHTML = `
          <div class="responses-list">
            ${visibleApplications.map((application) => `
              <button class="response-card" type="button" data-application-index="${application.id}">
                <span class="response-card-title">${escapeHtml(application.discordUsername || 'Unknown')}</span>
                <span class="response-card-meta">Roblox: ${escapeHtml(application.robloxUsername || 'Unknown')}</span>
              </button>
            `).join('')}
          </div>
        `;

        staffApplicationsList.querySelectorAll('[data-application-index]').forEach((button) => {
          button.addEventListener('click', () => {
            const applicationId = button.getAttribute('data-application-index');
            const application = applicationsCache.find((item) => item.id === applicationId);
            if (application) {
              showApplicationDetails(application);
            }
          });
        });

        if (totalPages > 1) {
          const pageButtons = Array.from({ length: totalPages }, (_, index) => {
            const pageNumber = index + 1;
            const isActive = pageNumber === currentPage;
            return `<button class="pagination-btn${isActive ? ' active' : ''}" type="button" data-page="${pageNumber}">${pageNumber}</button>`;
          }).join('');

          staffApplicationsPagination.innerHTML = `
            <button class="pagination-btn" type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
            ${pageButtons}
            <button class="pagination-btn" type="button" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>›</button>
          `;
          staffApplicationsPagination.hidden = false;
          staffApplicationsPagination.querySelectorAll('[data-page]').forEach((button) => {
            button.addEventListener('click', () => {
              const nextPage = Number(button.getAttribute('data-page'));
              if (!Number.isNaN(nextPage) && nextPage >= 1 && nextPage <= totalPages) {
                renderApplicationsPage(nextPage);
              }
            });
          });
        } else {
          staffApplicationsPagination.innerHTML = '';
          staffApplicationsPagination.hidden = true;
        }

        staffApplicationsList.hidden = false;
        staffApplicationDetails.hidden = true;
      }

      async function loadStaffApplications({ forceRefresh = false } = {}) {
        if (!staffApplicationsList || !staffApplicationsPagination) return;
        const profile = getCurrentProfile();
        if (!profile?.accessToken) {
          if (accessMessage) accessMessage.textContent = 'Log in with Discord to view applications.';
          applicationsCache = [];
          staffApplicationsList.innerHTML = '';
          staffApplicationsPagination.innerHTML = '';
          staffApplicationsPagination.hidden = true;
          staffApplicationsList.hidden = true;
          return;
        }

        if (!forceRefresh && applicationsCache.length) {
          renderApplicationsPage(currentPage);
          return;
        }

        try {
          const response = await fetch(buildStaffApiUrl('list'), {
            headers: {
              Authorization: `Bearer ${profile.accessToken}`,
            },
          });
          const result = await parseApiResponse(response);
          if (!response.ok) {
            if (response.status === 403) {
              accessMessage.textContent = 'You do not have permissions to view applications.';
            } else {
              accessMessage.textContent = result.error || 'Unable to load applications.';
            }
            applicationsCache = [];
            staffApplicationsList.innerHTML = '';
            staffApplicationsPagination.innerHTML = '';
            staffApplicationsPagination.hidden = true;
            staffApplicationsList.hidden = true;
            staffApplicationDetails.hidden = true;
            return;
          }

          if (accessMessage) {
            accessMessage.textContent = 'Your reviewer access is active.';
          }

          applicationsCache = Array.isArray(result.applications) ? result.applications : [];
          renderApplicationsPage(1);
        } catch (error) {
          if (accessMessage) accessMessage.textContent = 'Unable to load applications right now.';
          applicationsCache = [];
          staffApplicationsList.innerHTML = '';
          staffApplicationsPagination.innerHTML = '';
          staffApplicationsPagination.hidden = true;
          staffApplicationsList.hidden = true;
        }
      }

      updateDiscordUsernameField();

      if (responsesToggle) {
        responsesToggle.addEventListener('click', () => {
          if (responsesToggle.dataset.open === 'true') {
            responsesToggle.dataset.open = 'false';
            staffApplicationsList.hidden = true;
            staffApplicationsPagination.hidden = true;
            staffApplicationDetails.hidden = true;
            return;
          }

          responsesToggle.dataset.open = 'true';
          loadStaffApplications({ forceRefresh: true });
        });
      }

      if (staffForm) {
        staffForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const profile = getCurrentProfile();
          if (!profile?.accessToken) {
            if (staffFeedback) staffFeedback.textContent = 'Please log in with Discord before submitting your application.';
            return;
          }

          const data = {
            accessToken: profile.accessToken,
            discordUsername: discordUsernameField?.value,
            robloxUsername: document.getElementById('roblox-username')?.value,
            over13: document.getElementById('over-13')?.value,
            timeZone: document.getElementById('time-zone')?.value,
            microphone: document.getElementById('microphone')?.value,
            eBypass: document.getElementById('e-bypass')?.value,
            adminAbuse: document.getElementById('admin-abuse')?.value,
            harassment: document.getElementById('harassment')?.value,
            exploiting: document.getElementById('exploiting')?.value,
            nsfw: document.getElementById('nsfw')?.value,
            avoidPunishment: document.getElementById('avoid-punishment')?.value,
            filterBypass: document.getElementById('filter-bypass')?.value,
            disruptive: document.getElementById('disruptive')?.value,
            racist: document.getElementById('racist')?.value,
            onlineDating: document.getElementById('online-dating')?.value,
          };

          try {
            const response = await fetch(buildStaffApiUrl('submit'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            const result = await parseApiResponse(response);
            if (!response.ok) {
              throw new Error(result.error || 'Submission failed');
            }
            if (staffFeedback) {
              staffFeedback.textContent = 'Application submitted successfully. Thank you!';
            }
            staffForm.reset();
            updateDiscordUsernameField();
            if (responsesToggle?.dataset.open === 'true') {
              loadStaffApplications({ forceRefresh: true });
            }
          } catch (error) {
            if (staffFeedback) {
              staffFeedback.textContent = error.message;
            }
          }
        });
      }

      window.addEventListener('discord-auth-updated', () => {
        const profile = getCurrentProfile();
        updateDiscordUsernameField();
        refreshDiscordUi(profile);
        if (responsesToggle?.dataset.open === 'true') {
          loadStaffApplications({ forceRefresh: true });
        }
      });
    }

    function installProtection() {
      document.body.classList.add('no-select');

      document.addEventListener('contextmenu', (event) => {
        event.preventDefault();
      });

      document.addEventListener('selectstart', (event) => {
        event.preventDefault();
      });

      document.addEventListener('dragstart', (event) => {
        event.preventDefault();
      });

      document.addEventListener('copy', (event) => {
        event.preventDefault();
      });

      document.addEventListener('mousedown', (event) => {
        if (event.button === 1 || event.button === 2) {
          event.preventDefault();
        }
      });

      document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        const blocked =
          event.key === 'F12' ||
          (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
          (event.ctrlKey && key === 'u') ||
          (event.metaKey && event.altKey && key === 'i') ||
          (event.ctrlKey && key === 's') ||
          (event.ctrlKey && key === 'p') ||
          key === 'printscreen';

        if (blocked) {
          event.preventDefault();
          devtoolsOpen = true;
          window.location.replace('about:blank');
        }
      });

      window.setTimeout(() => {
        document.documentElement.classList.add('anti-fuzz');
      }, 2400);

      window.addEventListener('resize', evaluateDevtoolsSignals, { passive: true });

      window.setInterval(() => {
        if (!antiInspectState.triggered && devtoolsProbeCount < 6) {
          probeDebuggerPause();
        }
      }, 7000);
    }

    if (scrollTopButton) {
      scrollTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    setInterval(fetchPlayerCount, 15000);
    fetchPlayerCount();
    installScrollProgress();
    installBackgroundCanvas();
    installMotionEffects();
    installCounterAnimations();
    installFaqAccordion();
    installDiscordLogin();
    setupStaffApplicationPage();
    installProtection();
  }

  init();
})();
