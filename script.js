/* =========================================================
   autom8ig — interactive script
========================================================= */

/* ---------- nav scroll & burger ---------- */
const nav = document.getElementById('nav');
const burger = document.getElementById('burger');

window.addEventListener('scroll', () => {
  nav.classList.toggle('is-scrolled', window.scrollY > 12);
});

burger.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  burger.setAttribute('aria-expanded', open);
});
document.querySelectorAll('.nav__mobile a').forEach(a => {
  a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  });
});

/* ---------- hero phone — looping IG conversation ---------- */
const heroChat = document.getElementById('igChat');
const heroScript = [
  { side:'in',  text:'Hi! Do you ship to the UK? 🇬🇧' },
  { side:'out', text:'Hey Sarah! Yes — UK shipping is free over £50, takes 2–3 days ✨' },
  { side:'in',  text:'Amazing. Got a discount code? 🙏' },
  { side:'out', text:'Sure thing — use IG10 for 10% off your first order 💜' },
  { side:'in',  text:'You rock!' },
  { side:'out', text:'Anytime! Want me to DM you when restock drops? 🛍️' },
];

let heroIdx = 0;
function pumpHero(){
  if (!heroChat) return;
  const { side, text } = heroScript[heroIdx % heroScript.length];
  heroIdx++;

  // typing indicator for outgoing
  if (side === 'out'){
    const typing = document.createElement('div');
    typing.className = 'bubble bubble--typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    heroChat.appendChild(typing);
    cap(heroChat, 6);
    setTimeout(() => {
      typing.remove();
      addBubble(heroChat, side, text);
      cap(heroChat, 6);
    }, 900);
  } else {
    addBubble(heroChat, side, text);
    cap(heroChat, 6);
  }
}
function addBubble(host, side, text){
  const b = document.createElement('div');
  b.className = `bubble bubble--${side}`;
  b.textContent = text;
  host.appendChild(b);
}
function cap(host, max){
  while (host.children.length > max) host.removeChild(host.firstChild);
}
// kick off + interval
pumpHero();
setInterval(pumpHero, 2200);

/* ---------- hero email form ---------- */
const leadForm = document.getElementById('leadForm');
leadForm?.addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  if (!email) {
    window.location.href = '/signup';
    return;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    toast('Please enter a valid email');
    return;
  }
  window.location.href = '/signup?email=' + encodeURIComponent(email);
});

/* ---------- toast ---------- */
const toastEl = document.getElementById('toast');
let toastTimer;
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 3200);
}

/* ---------- pricing toggle ---------- */
const billing = document.getElementById('billingToggle');
billing?.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  billing.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === btn));
  const period = btn.dataset.bill;
  document.querySelectorAll('.amount').forEach(el => {
    const v = period === 'yearly' ? el.dataset.yearly : el.dataset.monthly;
    // animate
    el.style.transition = 'transform .25s ease, opacity .25s';
    el.style.transform = 'translateY(-6px)';
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = v;
      el.style.transform = 'translateY(0)';
      el.style.opacity = '1';
    }, 180);
  });
  document.querySelectorAll('.per').forEach(p => {
    p.textContent = period === 'yearly' ? '/mo · billed yearly' : '/mo';
  });
});

/* ---------- live demo ---------- */
const SCENARIOS = {
  shipping: {
    user:'Hey! When does my order ship?',
    bot:[
      'Hi there! 👋 Let me check on that for you…',
      'Orders placed before 2pm ship the same day 📦',
      'You\'ll get a tracking link by email within 24 hours. Want me to text it too?'
    ]
  },
  size: {
    user:'Do you have the lounge set in size M?',
    bot:[
      'Great pick! 👀 Let me peek at stock…',
      'Size M is in stock in cream, sage, and black 🎨',
      'Want me to drop the link to your DMs?'
    ]
  },
  discount: {
    user:'Got a discount code? 🙏',
    bot:[
      'Of course! 💜',
      'Use code FOLLOW10 for 10% off your first order',
      'Code auto-applies if you tap this link → autom8ig.io/shop ✨'
    ]
  },
  appointment: {
    user:'Can I book a consultation call?',
    bot:[
      'Absolutely! 📅',
      'I\'ve got openings Tuesday 2pm, Wednesday 10am, or Friday 4pm',
      'Which works best? I\'ll send a calendar invite right after.'
    ]
  },
  refund: {
    user:'How do refunds work?',
    bot:[
      'Easy peasy 💫',
      '30-day no-questions-asked returns. We even cover return shipping in the UK & US.',
      'Want me to start a return for you? Just send your order number 🙌'
    ]
  }
};

const demoMessages = document.getElementById('demoMessages');
const demoForm = document.getElementById('demoForm');
const demoInput = document.getElementById('demoInput');
const chips = document.querySelectorAll('.chip');
const statConv = document.getElementById('statConv');
const statTime = document.getElementById('statTime');

let convCount = 1247;
let avgTime = 0.4;

function renderConv(text){
  // animate stat counters
  convCount += Math.floor(Math.random()*3) + 1;
  avgTime = (0.3 + Math.random()*0.5).toFixed(1);
  statConv.textContent = convCount.toLocaleString();
  statTime.textContent = `${avgTime}s`;
}

function pushMsg(side, text, delay=0){
  return new Promise(resolve => {
    setTimeout(() => {
      const b = document.createElement('div');
      b.className = `bubble bubble--${side}`;
      b.textContent = text;
      demoMessages.appendChild(b);
      demoMessages.scrollTop = demoMessages.scrollHeight;
      resolve();
    }, delay);
  });
}
function pushTyping(){
  const t = document.createElement('div');
  t.className = 'bubble bubble--typing';
  t.innerHTML = '<span></span><span></span><span></span>';
  demoMessages.appendChild(t);
  demoMessages.scrollTop = demoMessages.scrollHeight;
  return t;
}

async function runScenario(key){
  demoMessages.innerHTML = '';
  const s = SCENARIOS[key];
  if (!s) return;
  await pushMsg('in', s.user, 200);
  for (const line of s.bot){
    const t = pushTyping();
    await wait(700 + Math.random()*400);
    t.remove();
    await pushMsg('out', line);
    await wait(380);
  }
  renderConv();
}
function wait(ms){return new Promise(r => setTimeout(r, ms))}

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    runScenario(chip.dataset.scenario);
  });
});

// Free-text input → smart-match scenario, or generic AI-ish reply
demoForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const text = demoInput.value.trim();
  if (!text) return;
  demoInput.value = '';
  await pushMsg('in', text, 100);
  const reply = matchReply(text);
  for (const line of reply){
    const t = pushTyping();
    await wait(600 + Math.random()*400);
    t.remove();
    await pushMsg('out', line);
    await wait(280);
  }
  renderConv();
});

function matchReply(txt){
  const t = txt.toLowerCase();
  if (/ship|deliver|track|order/.test(t)) return SCENARIOS.shipping.bot;
  if (/size|stock|color|colour|fit/.test(t)) return SCENARIOS.size.bot;
  if (/discount|code|coupon|promo|sale/.test(t)) return SCENARIOS.discount.bot;
  if (/book|call|appoint|consult|meeting/.test(t)) return SCENARIOS.appointment.bot;
  if (/refund|return|exchange/.test(t)) return SCENARIOS.refund.bot;
  if (/hi|hey|hello/.test(t)) return ['Hey there! 👋','I\'m the autom8ig demo bot. Ask me about shipping, sizes, discounts, bookings or refunds!'];
  return [
    'Got it — let me check that for you 🔎',
    'In a real setup I\'d pull from your FAQs, products, and inbox history.',
    'Try one of the chips on the left to see a full automated flow ✨'
  ];
}

// kick off demo
runScenario('shipping');

/* ---------- intersection animations ---------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting){
      en.target.style.opacity = 1;
      en.target.style.transform = 'translateY(0)';
      io.unobserve(en.target);
    }
  });
}, { threshold:.12 });

document.querySelectorAll('.card,.plan,blockquote,.steps li').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity .6s ease, transform .6s ease';
  io.observe(el);
});

/* ---------- log a friendly hello ---------- */
console.log('%c autom8ig ', 'background:linear-gradient(135deg,#f857a6,#7b3ff2);color:white;font-weight:700;padding:6px 12px;border-radius:6px;font-size:14px;', 'Instagram on autopilot. hello@autom8ig.io');
