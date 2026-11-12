(() => {
  const SUITS = [
    { id: 'clubs', symbol: '♣', name: 'Clubs', color: 'black' },
    { id: 'spades', symbol: '♠', name: 'Spades', color: 'black' },
    { id: 'hearts', symbol: '♥', name: 'Hearts', color: 'red' },
    { id: 'diamonds', symbol: '♦', name: 'Diamonds', color: 'red' }
  ];
  const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const TRUMP_ORDER = { J: 8, 9: 7, A: 6, 10: 5, K: 4, Q: 3, 8: 2, 7: 1 };
  const PLAIN_ORDER = { A: 8, 10: 7, K: 6, Q: 5, J: 4, 9: 3, 8: 2, 7: 1 };
  const TRUMP_POINTS = { J: 20, 9: 14, A: 11, 10: 10, K: 4, Q: 3, 8: 0, 7: 0 };
  const PLAIN_POINTS = { A: 11, 10: 10, K: 4, Q: 3, J: 2, 9: 0, 8: 0, 7: 0 };
  const PLAYERS = [
    { name: 'You', team: 0, initials: 'Y' },
    { name: 'Marta', team: 1, initials: 'M' },
    { name: 'Emil', team: 0, initials: 'E' },
    { name: 'Greta', team: 1, initials: 'G' }
  ];
  const $ = (id) => document.getElementById(id);
  const state = {
    round: 1, scores: [0, 0], tricks: [0, 0], hands: [[], [], [], []], dealer: 0,
    trump: null, orgi: null, phase: 'bidding', bidOrder: [], bidIndex: 0, passes: 0,
    acceptor: null, bidSuit: null, shot: false, trick: [], turn: 0, trickNo: 0,
    roundPoints: [0, 0], melds: [[], []], meldAwarded: false, legal: [],
    design: 1, learn: false, sound: true, cardPlayed: false, busy: false
  };
  const rules = {
    play: '<ul><li>Four players, two cross-teams. You and Emil play against Marta and Greta.</li><li>Say <strong>Abnehmen</strong> to take the turned-up Orgi as trump, or <strong>Weg</strong> to pass. The other team may call <strong>Schuss</strong> to double the hand.</li><li>Three passes means <strong>Letzter muss</strong>: the dealer chooses trump. The opposing team may <strong>Schenken</strong>, conceding 50 points to the dealer team. Play clockwise; follow suit, trump when void, and over-trump when possible.</li><li>After eight tricks, card points plus melds and the last-trick bonus decide the hand.</li></ul>',
    cards: '<p><strong>Trump:</strong> Jass (J) 20 · Mi (9) 14 · Ace 11 · 10 10 · King 4 · Queen 3 · 8/7 0</p><p><strong>Side suits:</strong> Ace 11 · 10 10 · King 4 · Queen 3 · Jack 2 · 9/8/7 0. Winning tricks takes the cards in them.</p>',
    melds: '<p><strong>Terz</strong> — three consecutive ranks in one suit, 20 points.<br><strong>Halb</strong> — four or more consecutive ranks in one suit, 50 points.<br><strong>Bella</strong> — trump King + Queen, 20 points.</p><p>Only the strongest sequence on a team scores (Bella is added). Your melds are called out when the hand starts.</p>'
  };
  const rankLabel = (r) => ({ J: 'J', Q: 'Q', K: 'K', A: 'A' }[r] || r);
  const cardPoints = (card, trump) => card.suit === trump ? TRUMP_POINTS[card.rank] : PLAIN_POINTS[card.rank];
  const cardPower = (card, trump) => card.suit === trump ? 100 + TRUMP_ORDER[card.rank] : PLAIN_ORDER[card.rank];
  const teamName = (team) => team === 0 ? 'US' : 'THEM';
  const makeDeck = () => SUITS.flatMap(suit => RANKS.map(rank => ({ suit: suit.id, symbol: suit.symbol, color: suit.color, rank, id: `${rank}-${suit.id}` })));
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const suitById = (id) => SUITS.find(s => s.id === id);

  function sortHand(hand) {
    return hand.sort((a, b) => {
      const at = a.suit === state.trump ? 1 : 0, bt = b.suit === state.trump ? 1 : 0;
      if (at !== bt) return at - bt;
      const suitDiff = SUITS.findIndex(s => s.id === a.suit) - SUITS.findIndex(s => s.id === b.suit);
      if (suitDiff) return suitDiff;
      const order = a.suit === state.trump ? TRUMP_ORDER : PLAIN_ORDER;
      return order[b.rank] - order[a.rank];
    });
  }
  function meldsFor(hand) {
    const found = [];
    for (const suit of SUITS) {
      const ranks = new Set(hand.filter(c => c.suit === suit.id).map(c => c.rank));
      let best = 0;
      for (let i = 0; i < RANKS.length;) {
        let j = i + 1;
        while (j < RANKS.length && ranks.has(RANKS[j])) j++;
        const len = j - i;
        if (len >= 3) best = Math.max(best, len >= 4 ? 50 : 20);
        i = j;
      }
      if (best) found.push({ type: best === 50 ? 'HALB' : 'TERZ', points: best, suit: suit.id });
    }
    if (state.trump && hand.some(c => c.suit === state.trump && c.rank === 'K') && hand.some(c => c.suit === state.trump && c.rank === 'Q')) found.push({ type: 'BELLA', points: 20, suit: state.trump });
    return found;
  }
  function evaluateMelds() {
    state.melds = [[], []];
    for (let p = 0; p < 4; p++) state.melds[PLAYERS[p].team].push(...meldsFor(state.hands[p]));
  }
  function deal() {
    state.hands = [[], [], [], []];
    const deck = shuffle(makeDeck());
    // The turned-up Orgi is the dealer's eighth card, so all 32 cards stay in play.
    for (let i = 0; i < 32; i++) state.hands[Math.floor(i / 8)].push(deck[i]);
    state.orgi = state.hands[state.dealer][7];
    state.trump = null; state.phase = 'bidding'; state.passes = 0; state.acceptor = null;
    state.bidSuit = null; state.shot = false; state.trick = []; state.trickNo = 0;
    state.roundPoints = [0, 0]; state.tricks = [0, 0]; state.meldAwarded = false;
    state.bidOrder = Array.from({ length: 4 }, (_, i) => (state.dealer + 1 + i) % 4);
    state.bidIndex = 0; state.busy = false; state.cardPlayed = false;
    state.counterPlayer = null; state.counterTeam = null; state.giftChooser = null;
    state.hands.forEach(sortHand);
    setMessage('BIDDING', 'Choose your bid');
    update();
    advanceBid();
  }
  function setMessage(kicker, text) { $('messageText').textContent = text; document.querySelector('.message-kicker').textContent = kicker; }
  function botStrength(player, suit) {
    const cards = state.hands[player];
    let score = cards.filter(c => c.suit === suit).reduce((sum, c) => sum + (c.rank === 'J' ? 4 : c.rank === '9' ? 3 : c.rank === 'A' ? 2 : c.rank === '10' ? 1.5 : 0.2), 0);
    score += cards.filter(c => c.suit === suit).length * 0.45;
    return score;
  }
  function beginBiddingTurn() {
    if (state.phase !== 'bidding' || state.busy) return;
    if (state.passes >= 3) {
      state.phase = 'forced';
      setMessage('LETZTER MUSS', state.dealer === 0 ? 'Choose a trump suit' : `${PLAYERS[state.dealer].name} must choose trump`);
      update();
      if (state.dealer !== 0) setTimeout(() => chooseForcedTrump(), 800);
      return;
    }
    if (state.bidIndex >= 4) { state.phase = 'forced'; update(); return; }
    const player = state.bidOrder[state.bidIndex];
    state.turn = player;
    if (player === 0) {
      setMessage('YOUR BID', 'Will you take the Orgi?');
      update();
    } else {
      state.busy = true;
      setTimeout(() => {
        const strength = botStrength(player, state.orgi.suit);
        const accepts = strength > (PLAYERS[player].team === 0 ? 3.2 : 3.7) && (Math.random() > 0.2 || strength > 4.5);
        state.busy = false;
        if (accepts) acceptBid(player); else passBid(player);
      }, 750);
    }
  }
  function advanceBid() { beginBiddingTurn(); }
  function passBid(player = 0) {
    if (state.phase !== 'bidding' || player !== state.bidOrder[state.bidIndex]) return;
    state.passes++; state.bidIndex++;
    if (player === 0) toast('You said Weg');
    advanceBid(); update();
  }
  function acceptBid(player = 0) {
    if (state.phase !== 'bidding' || player !== state.bidOrder[state.bidIndex]) return;
    state.acceptor = player; state.bidSuit = state.orgi.suit; state.trump = state.orgi.suit;
    const acceptTeam = PLAYERS[player].team;
    state.phase = 'counter';
    state.counterTeam = 1 - acceptTeam;
    state.counterTried = false;
    setMessage('ABGENOMMEN', `${PLAYERS[player].name} takes ${suitById(state.trump).name}`);
    update();
    const counterPlayer = (player + 1) % 4;
    if (PLAYERS[counterPlayer].team === state.counterTeam) {
      state.counterPlayer = counterPlayer;
      if (counterPlayer === 0) {
        setTimeout(() => { setMessage('COUNTER BID', 'Double the stakes with Schuss?'); update(); }, 650);
      } else {
        state.busy = true;
        setTimeout(() => {
          state.busy = false;
          const strength = botStrength(counterPlayer, state.trump);
          if (strength > 4.2 && Math.random() > 0.3) applySchuss(counterPlayer); else startPlay();
        }, 950);
      }
    } else startPlay();
  }
  function applySchuss(player = 0) {
    if (state.phase !== 'counter') return;
    state.shot = true;
    toast(`${PLAYERS[player].name} calls Schuss — stakes doubled`);
    startPlay();
  }
  function chooseForcedTrump() {
    if (state.phase !== 'forced') return;
    if (state.dealer === 0) { update(); return; }
    const dealerHand = state.hands[state.dealer];
    const suits = SUITS.map(s => s.id).sort((a, b) => botStrength(state.dealer, b) - botStrength(state.dealer, a));
    const best = suits[0];
    // An opposing side may gift a suit; bots occasionally gift a weak suit to the dealer.
    state.trump = best;
    state.bidSuit = best; state.acceptor = state.dealer;
    continueAfterForced();
  }
  function chooseSuit(suit) {
    if (state.phase !== 'forced' || state.dealer !== 0) return;
    state.trump = suit; state.bidSuit = suit; state.acceptor = 0;
    continueAfterForced();
  }
  function startPlay() {
    state.phase = 'play'; state.turn = state.dealer;
    state.trick = []; state.trickNo = 0; state.cardPlayed = false; state.busy = false;
    state.hands.forEach(sortHand); evaluateMelds();
    const ourMelds = state.melds[0];
    const meldText = ourMelds.length ? `Your meld: ${ourMelds.map(m => `${m.type} +${m.points}`).join(' · ')}` : 'Eight tricks. Make every card count.';
    setMessage('TRICK 1 OF 8', meldText);
    if (state.learn) toast('Lead any card. The highest card in the led suit—or trump—wins.');
    update();
    if (state.turn !== 0) scheduleBotPlay();
  }

  function legalCards(player) {
    const hand = state.hands[player];
    if (!state.trick.length) return [...hand];
    const ledSuit = state.trick[0].card.suit;
    const following = hand.filter(c => c.suit === ledSuit);
    if (following.length && ledSuit !== state.trump) return following;
    const trumps = hand.filter(c => c.suit === state.trump);
    if (following.length && ledSuit === state.trump) {
      const currentTrump = state.trick.reduce((best, play) => cardPower(play.card, state.trump) > cardPower(best, state.trump) ? play.card : best, state.trick[0].card);
      const over = following.filter(c => cardPower(c, state.trump) > cardPower(currentTrump, state.trump));
      return over.length ? over : following;
    }
    if (!trumps.length) return [...hand];
    const currentTrump = state.trick.filter(x => x.card.suit === state.trump).sort((a, b) => cardPower(b.card, state.trump) - cardPower(a.card, state.trump))[0];
    if (currentTrump) {
      const over = trumps.filter(c => cardPower(c, state.trump) > cardPower(currentTrump.card, state.trump));
      if (over.length) return over;
    }
    return trumps;
  }
  function winnerOf(trick) {
    const ledSuit = trick[0].card.suit;
    let winner = trick[0];
    const value = (card) => card.suit === state.trump ? cardPower(card, state.trump) + 1000 : card.suit === ledSuit ? cardPower(card, state.trump) : -1;
    for (const play of trick.slice(1)) if (value(play.card) > value(winner.card)) winner = play;
    return winner;
  }
  function botChooseCard(player) {
    const legal = legalCards(player);
    const teammateWinning = state.trick.length && PLAYERS[winnerOf(state.trick).player].team === PLAYERS[player].team;
    const ordered = [...legal].sort((a, b) => cardPower(a, state.trump) - cardPower(b, state.trump));
    if (teammateWinning) return ordered[0];
    const currentWinner = state.trick.length ? winnerOf(state.trick) : null;
    const winning = ordered.filter(c => {
      const candidate = [...state.trick, { player, card: c }];
      return winnerOf(candidate).player === player;
    });
    if (winning.length) return winning[0];
    return ordered[0];
  }
  function playCard(player, card) {
    if (state.phase !== 'play' || player !== state.turn || state.busy) return;
    const legal = legalCards(player);
    if (!legal.some(c => c.id === card.id)) { toast('You must follow suit, trump, and over-trump when possible.'); return; }
    const hand = state.hands[player];
    state.hands[player] = hand.filter(c => c.id !== card.id);
    state.trick.push({ player, card }); state.cardPlayed = true;
    if (player === 0) playSound();
    if (state.trick.length < 4) {
      state.turn = (player + 1) % 4;
      setMessage(`TRICK ${state.trickNo + 1} OF 8`, `${PLAYERS[state.turn].name}'s turn`);
      update();
      if (state.turn !== 0) scheduleBotPlay();
    } else {
      state.busy = true; update();
      setTimeout(finishTrick, 1050);
    }
  }
  function scheduleBotPlay() {
    if (state.phase !== 'play' || state.turn === 0 || state.busy) return;
    state.busy = true; update();
    setTimeout(() => {
      state.busy = false;
      if (state.phase !== 'play' || state.turn === 0) return;
      const card = botChooseCard(state.turn);
      playCard(state.turn, card);
    }, 650 + Math.random() * 450);
  }
  function finishTrick() {
    const winner = winnerOf(state.trick);
    const team = PLAYERS[winner.player].team;
    const points = state.trick.reduce((sum, play) => sum + cardPoints(play.card, state.trump), 0);
    state.roundPoints[team] += points; state.tricks[team]++;
    if (state.trickNo === 7) state.roundPoints[team] += 10;
    state.trickNo++;
    const winnerName = PLAYERS[winner.player].name;
    state.busy = false;
    if (state.trickNo >= 8) { endRound(); return; }
    state.trick = []; state.turn = winner.player;
    setMessage(`TRICK ${state.trickNo + 1} OF 8`, `${winnerName} wins · ${points}${state.trickNo === 8 ? ' + last trick' : ''} pts`);
    update();
    if (state.turn !== 0) scheduleBotPlay();
  }
  function endRound() {
    const winningTeam = state.roundPoints[0] > state.roundPoints[1] ? 0 : 1;
    // A meld is valid only when its side wins at least one trick; sequence points are capped to the best per team.
    for (let team = 0; team < 2; team++) {
      if (!state.tricks[team]) continue;
      const teamMelds = state.melds[team];
      const sequences = teamMelds.filter(m => m.type !== 'BELLA');
      const best = sequences.reduce((n, m) => Math.max(n, m.points), 0);
      const bella = teamMelds.some(m => m.type === 'BELLA') ? 20 : 0;
      state.roundPoints[team] += best + bella;
    }
    if (state.roundPoints[0] === state.roundPoints[1]) state.roundPoints[winningTeam] += 1;
    const multiplier = state.shot ? 2 : 1;
    state.scores[0] += state.roundPoints[0] * multiplier;
    state.scores[1] += state.roundPoints[1] * multiplier;
    const hasWinner = state.scores.some(s => s >= 1000);
    state.phase = 'roundEnd';
    setMessage(hasWinner ? 'GAME OVER' : `ROUND ${String(state.round).padStart(2, '0')} COMPLETE`, `${teamName(winningTeam)} take ${state.roundPoints[winningTeam]} points${state.shot ? ' · SCHUSS ×2' : ''}`);
    update();
    if (!hasWinner) state.roundTimer = setTimeout(() => { state.round++; state.dealer = (state.dealer + 1) % 4; deal(); }, 4200);
  }

  function cardMarkup(card, opts = {}) {
    const cls = ['card', card.color, `design-${state.design}`, card.suit === state.trump ? 'trump' : '', opts.back ? 'back' : '', opts.played ? 'played-card' : ''].filter(Boolean).join(' ');
    if (opts.back) return `<div class="${cls}" aria-label="Hidden card"></div>`;
    const face = `<div class="card-corner"><b>${rankLabel(card.rank)}</b><i>${card.symbol}</i></div><div class="card-suit">${card.symbol}</div><div class="card-corner bottom"><b>${rankLabel(card.rank)}</b><i>${card.symbol}</i></div>`;
    return `<div class="${cls}" ${opts.clickable ? `tabindex="0" role="button" aria-label="${card.rank} of ${suitById(card.suit).name}" data-card="${card.id}"` : ''}>${face}${opts.hand ? `<span class="card-value">${cardPoints(card, state.trump)} PTS</span>` : ''}</div>`;
  }
  function renderSeats() {
    for (let i = 1; i <= 3; i++) {
      const seat = $(`seat-${i}`), p = PLAYERS[i];
      const isPartner = p.team === 0;
      const active = state.phase === 'play' && state.turn === i;
      seat.innerHTML = `<div class="bot-label"><span class="avatar ${isPartner ? 'partner' : 'opponent'}">${p.initials}</span><span><strong>${p.name}${active ? ' ·' : ''}</strong><small>${isPartner ? 'Partner' : 'Opponent'}</small></span></div><span class="bot-count">${state.hands[i].length} cards</span>`;
    }
  }
  function renderHand() {
    const hand = state.hands[0];
    const canPlayNow = state.phase === 'play' && state.turn === 0 && !state.busy;
    const legal = canPlayNow ? legalCards(0) : [];
    $('playerHand').innerHTML = hand.map((card, i) => {
      const playable = legal.some(c => c.id === card.id);
      const disabled = canPlayNow && !playable;
      const total = hand.length;
      const angle = (i - (total - 1) / 2) * Math.min(3.2, 23 / Math.max(1, total - 1));
      const lift = Math.abs(i - (total - 1) / 2) * 1.2;
      const cls = ['card', card.color, `design-${state.design}`, card.suit === state.trump ? 'trump' : '', disabled ? 'illegal' : ''].filter(Boolean).join(' ');
      return `<div class="${cls}" style="transform:translateY(${lift}px) rotate(${angle}deg);z-index:${i + 1}" ${canPlayNow ? `tabindex="0" role="button" data-card="${card.id}" aria-label="${card.rank} of ${suitById(card.suit).name}${disabled ? ', not playable' : ''}"` : ''}><div class="card-corner"><b>${rankLabel(card.rank)}</b><i>${card.symbol}</i></div><div class="card-suit">${card.symbol}</div><div class="card-corner bottom"><b>${rankLabel(card.rank)}</b><i>${card.symbol}</i></div><span class="card-value">${cardPoints(card, state.trump)} PTS</span></div>`;
    }).join('');
  }

  function renderTrick() {
    $('trickCards').innerHTML = state.trick.map(play => {
      const relative = (play.player - 0 + 4) % 4;
      return `<div class="played-card pos-${relative}">${cardMarkup(play.card, { played: true })}</div>`;
    }).join('');
  }
  function renderOrgi() {
    const host = $('orgiCard');
    host.innerHTML = state.orgi ? cardMarkup(state.orgi) : '';
    host.classList.toggle('picked-up', Boolean(state.trump && state.trump === state.orgi.suit));
  }
  function renderControls() {
    const host = $('controls');
    const button = (label, action, cls = '') => `<button class="action-button ${cls}" data-action="${action}">${label}</button>`;
    let html = '';
    if (state.phase === 'bidding' && state.turn === 0 && !state.busy) {
      html = button(`ABNEHMEN ${state.orgi.symbol}`, 'accept', 'primary') + button('WEG', 'pass');
    } else if (state.phase === 'counter' && state.counterPlayer === 0) {
      html = button('SCHUSS · DOUBLE', 'schuss', 'primary') + button('NO SCHUSS', 'decline');
    } else if (state.phase === 'forced' && state.dealer === 0) {
      html = `<span class="control-hint">LETZTER MUSS · CHOOSE TRUMP</span>` + SUITS.map(s => button(`${s.symbol} ${s.name}`, `suit:${s.id}`, s.id === state.orgi.suit ? 'primary' : '')).join('');
    } else if (state.phase === 'forcedGift' && state.giftChooser === 0) {
      html = button('SCHENKEN · GIFT 50', 'gift', 'primary') + button('PLAY THE HAND', 'continue');
    } else if (state.phase === 'play' && state.turn === 0) {
      html = `<span class="control-hint">${state.busy ? 'TRICK COMPLETE' : 'YOUR PLAY · FOLLOW SUIT'}</span>`;
    } else if (state.phase === 'roundEnd') {
      html = button(state.scores.some(s => s >= 1000) ? 'NEW GAME' : 'NEXT HAND', 'next', 'primary');
    }
    host.innerHTML = html;
  }
  function update() {
    $('roundLabel').textContent = `ROUND ${String(state.round).padStart(2, '0')}`;
    $('phaseLabel').textContent = state.phase === 'forcedGift' ? 'SCHENKEN' : state.phase.toUpperCase();
    $('usScore').textContent = state.scores[0]; $('themScore').textContent = state.scores[1];
    $('usTricks').textContent = `${state.tricks[0]} tricks`;
    $('themTricks').textContent = `${state.tricks[1]} tricks`;
    $('trumpSuit').textContent = state.trump ? suitById(state.trump).symbol : '—';
    $('trumpIndicator').classList.toggle('active', Boolean(state.trump));
    $('dealerChip').textContent = `${PLAYERS[state.dealer].name.toUpperCase()} · DEALER`;
    $('yourTurn').classList.toggle('visible', state.phase === 'play' && state.turn === 0 && !state.busy);
    renderSeats(); renderHand(); renderTrick(); renderOrgi(); renderControls();
  }
  function showControls() { update(); }
  let toastTimer;
  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2600);
  }
  function playSound() {
    if (!state.sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = 420;
      gain.gain.setValueAtTime(0.035, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.08);
      osc.onended = () => ctx.close();
    } catch (_) { /* Audio is optional. */ }
  }
  function continueAfterForced() {
    if (state.dealer === 0 || PLAYERS[state.dealer].team === 0) { startPlay(); return; }
    state.phase = 'forcedGift'; state.giftChooser = 0;
    setMessage('SCHENKEN?', 'Gift the dealer team 50 points or play on');
    update();
  }
  function giftDealerTeam() {
    const team = PLAYERS[state.dealer].team;
    state.roundPoints[team] += 50;
    toast(`Schenken! 50 points gifted to ${PLAYERS[state.dealer].name}'s team`);
    startPlay();
  }
  function openRules(tab = 'play') {
    $('modalBackdrop').hidden = false;
    document.querySelectorAll('.rules-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $('rulesContent').innerHTML = rules[tab];
  }
  function newGame() {
    state.round = 1; state.scores = [0, 0]; state.dealer = Math.floor(Math.random() * 4); deal();
  }
  $('controls').addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'accept') acceptBid();
    else if (action === 'pass') passBid();
    else if (action === 'schuss') applySchuss();
    else if (action === 'decline') startPlay();
    else if (action.startsWith('suit:')) { state.trump = action.slice(5); state.bidSuit = state.trump; state.acceptor = state.dealer; continueAfterForced(); }
    else if (action === 'gift') giftDealerTeam();
    else if (action === 'continue') startPlay();
    else if (action === 'next') { if (state.scores.some(s => s >= 1000)) newGame(); else { clearTimeout(state.roundTimer); state.round++; state.dealer = (state.dealer + 1) % 4; deal(); } }
  });
  $('playerHand').addEventListener('click', event => {
    const el = event.target.closest('[data-card]');
    if (!el || el.classList.contains('illegal')) return;
    const card = state.hands[0].find(c => c.id === el.dataset.card);
    if (card) playCard(0, card);
  });
  $('playerHand').addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-card]')) { event.preventDefault(); event.target.click(); }
  });
  $('designButton').addEventListener('click', () => { state.design = state.design % 3 + 1; update(); toast(`Card design ${state.design} of 3`); });
  $('soundButton').addEventListener('click', event => { state.sound = !state.sound; event.currentTarget.classList.toggle('muted', !state.sound); toast(state.sound ? 'Sound on' : 'Sound off'); });
  $('rulesButton').addEventListener('click', () => openRules());
  $('closeModal').addEventListener('click', () => { $('modalBackdrop').hidden = true; });
  $('modalBackdrop').addEventListener('click', event => { if (event.target === $('modalBackdrop')) $('modalBackdrop').hidden = true; });
  document.querySelector('.rules-tabs').addEventListener('click', event => {
    const tab = event.target.closest('[data-tab]')?.dataset.tab;
    if (!tab) return;
    document.querySelectorAll('.rules-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $('rulesContent').innerHTML = rules[tab];
  });
  $('learnToggle').addEventListener('change', event => { state.learn = event.target.checked; if (state.learn) toast('Learning hints are on'); });
  $('newGameButton').addEventListener('click', newGame);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') $('modalBackdrop').hidden = true; });

  state.dealer = Math.floor(Math.random() * 4);
  deal();
})();
