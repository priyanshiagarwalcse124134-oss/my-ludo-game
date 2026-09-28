(() => {
  const colors = ['red', 'green', 'yellow', 'blue'];
  const names = { red: 'Ruby', green: 'Clover', yellow: 'Sunny', blue: 'Sky' };
  const starts = { red: 0, green: 13, yellow: 26, blue: 40 };
  const safeIndices = [0, 8, 13, 21, 26, 34, 40, 47];
  const baseSlots = {
    red: [[14.5,14.5], [25.5,14.5], [14.5,25.5], [25.5,25.5]],
    green: [[74.5,14.5], [85.5,14.5], [74.5,25.5], [85.5,25.5]],
    blue: [[14.5,74.5], [25.5,74.5], [14.5,85.5], [25.5,85.5]],
    yellow: [[74.5,74.5], [85.5,74.5], [74.5,85.5], [85.5,85.5]]
  };
  const homeLanes = {
    red: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    green: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    yellow: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
    blue: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
  };
  const route = [];
  for (let c = 1; c <= 5; c++) route.push([6,c]);
  for (let r = 5; r >= 0; r--) route.push([r,6]);
  route.push([0,7],[0,8]);
  for (let r = 1; r <= 5; r++) route.push([r,8]);
  for (let c = 9; c <= 14; c++) route.push([6,c]);
  route.push([7,14],[8,14]);
  for (let c = 13; c >= 9; c--) route.push([8,c]);
  for (let r = 9; r <= 14; r++) route.push([r,8]);
  route.push([14,7],[14,6]);
  for (let r = 13; r >= 9; r--) route.push([r,6]);
  for (let c = 5; c >= 0; c--) route.push([8,c]);
  route.push([7,0],[6,0]);
  // The track is a 52-cell loop. Keep its color starts aligned to the four entry squares.
  const uniqueRoute = route.filter((p, i, a) => i === 0 || p[0] !== a[i-1][0] || p[1] !== a[i-1][1]);
  const spacesEl = document.getElementById('spaces');
  const tokensEl = document.getElementById('tokens');
  const playerList = document.getElementById('playerList');
  const gameMessage = document.getElementById('gameMessage');
  const dieFace = document.getElementById('dieFace');
  const diceButton = document.getElementById('diceButton');
  const turnCard = document.getElementById('turnCard');
  const setupCard = document.getElementById('setupCard');
  const turnName = document.getElementById('turnName');
  const turnIndicator = document.getElementById('turnIndicator');
  const colorSelection = document.getElementById('colorSelection');
  const playerOneColor = document.getElementById('playerOneColor');
  const playerTwoColor = document.getElementById('playerTwoColor');
  let playerCount = 4, players = [], current = 0, rolled = null, running = false, busy = false;
  const tokenElements = new Map();

  function fillColorPicker(select, selected) {
    select.replaceChildren(...colors.map(color => {
      const option=document.createElement('option');
      option.value=color; option.textContent=`${names[color]} (${color[0].toUpperCase()}${color.slice(1)})`;
      option.selected=color===selected; return option;
    }));
  }
  fillColorPicker(playerOneColor,'red'); fillColorPicker(playerTwoColor,'yellow');
  playerOneColor.addEventListener('change',()=>{
    if(playerOneColor.value===playerTwoColor.value) playerTwoColor.value=colors.find(color=>color!==playerOneColor.value);
  });
  playerTwoColor.addEventListener('change',()=>{
    if(playerTwoColor.value===playerOneColor.value) playerOneColor.value=colors.find(color=>color!==playerTwoColor.value);
  });

  // Build a 15 x 15 board, leaving the colored bases and center visible beneath the track.
  const coordKey = (r,c) => `${r},${c}`;
  const routeMap = new Map(uniqueRoute.map((p,i) => [coordKey(...p), i]));
  const homeMap = new Map();
  for (const color of colors) homeLanes[color].slice(0,5).forEach(([r,c],i) => homeMap.set(coordKey(r,c), {color, step:i}));
  const startColors = new Map(colors.map(color => [starts[color], color]));
  for (let r=0;r<15;r++) for (let c=0;c<15;c++) {
    const pos = coordKey(r,c), idx = routeMap.get(pos), lane = homeMap.get(pos);
    if (idx !== undefined) {
      const cell = document.createElement('div'); cell.className = 'space';
      if (safeIndices.includes(idx)) cell.classList.add('safe');
      if (startColors.has(idx)) cell.classList.add(`start-${startColors.get(idx)}`);
      cell.style.gridRow = idx === starts.blue ? r+2 : r+1;
      cell.style.gridColumn = c+1; spacesEl.append(cell);
    }
    if (lane) {
      const cell = document.createElement('div'); cell.className = `space home-lane-${lane.color}`;
      cell.style.gridRow = r+1; cell.style.gridColumn = c+1; spacesEl.append(cell);
    }
  }
  function cellCenter(r,c) { return {x:(c+0.5)*100/15,y:(r+0.5)*100/15}; }
  function tokenPosition(color, token) {
    if (token.progress < 0) return {x:baseSlots[color][token.id][0],y:baseSlots[color][token.id][1]};
    if (token.progress >= 57) return cellCenter(...homeLanes[color][5]);
    if (token.progress >= 52) return cellCenter(...homeLanes[color][token.progress-52]);
    return cellCenter(...uniqueRoute[(starts[color]+token.progress)%52]);
  }
  function renderTokens(movable=[]) {
    for (const player of players) player.tokens.forEach(token => {
      const key=`${player.color}-${token.id}`;
      let el=tokenElements.get(key);
      if (!el) {
        el=document.createElement('button'); el.type='button';
        tokenElements.set(key,el); tokensEl.append(el);
      }
      const point=tokenPosition(player.color,token);
      el.className=`token ${player.color}${token.progress===57?' finished':''}`;
      el.style.left=`${point.x}%`; el.style.top=`${point.y}%`;
      el.setAttribute('aria-label',`${names[player.color]} token ${token.id+1}${movable.includes(token)?', movable':''}`);
      el.textContent=String(token.id+1);
      el.disabled=!movable.includes(token);
      el.onclick=movable.includes(token)?()=>moveToken(player,token):null;
      if (movable.includes(token)) el.classList.add('movable');
    });
  }
  function renderPlayers() {
    playerList.replaceChildren();
    for (const p of players) {
      const row=document.createElement('div'); row.className=`player-row${running&&players[current]===p?' current':''}`;
      const done=p.tokens.filter(t=>t.progress===57).length;
      row.innerHTML=`<span class="player-id"><i class="player-chip" style="background:var(--${p.color})"></i>${names[p.color]}</span><strong>${done}/4 HOME</strong>`;
      playerList.append(row);
    }
    if (running) {
      turnName.textContent=names[players[current].color]; turnName.style.color=`var(--${players[current].color})`;
      turnIndicator.textContent=`${current+1} / ${players.length}`;
    } else turnIndicator.textContent='READY';
  }
  function startGame() {
    tokenElements.clear(); tokensEl.replaceChildren();
    const chosenColors=playerCount===2?[playerOneColor.value,playerTwoColor.value]:colors.slice(0,playerCount);
    players=chosenColors.map(color=>({color,tokens:Array.from({length:4},(_,id)=>({id,progress:-1}))}));
    // For three players omit blue; the remaining colors keep their familiar board homes.
    current=0; rolled=null; running=true; busy=false;
    setupCard.hidden=true; turnCard.hidden=false; diceButton.disabled=false;
    gameMessage.textContent='Roll a 6 to bring a token out.'; dieFace.textContent='\u2684';
    renderPlayers(); renderTokens();
  }
  function validTokens(player,roll) {
    return player.tokens.filter(t => t.progress===-1 ? roll===6 : t.progress<57 && t.progress+roll<=57);
  }
  function nextPlayer(extra=false) {
    if (!extra) current=(current+1)%players.length;
    rolled=null; diceButton.disabled=false; renderPlayers(); renderTokens();
  }
  async function rollDice() {
    if (!running||rolled!==null||busy) return;
    busy=true; diceButton.disabled=true; diceButton.classList.add('rolling');
    gameMessage.textContent='Rolling the dice...';
    const faces=['\u2680','\u2681','\u2682','\u2683','\u2684','\u2685'];
    for(let spin=0;spin<9;spin++) {
      dieFace.textContent=faces[Math.floor(Math.random()*6)];
      await pause(75);
      if(!running) { diceButton.classList.remove('rolling'); busy=false; return; }
    }
    rolled=Math.floor(Math.random()*6)+1;
    dieFace.textContent=faces[rolled-1];
    diceButton.classList.remove('rolling'); busy=false;
    const player=players[current], moves=validTokens(player,rolled);
    if (!moves.length) {
      gameMessage.textContent=rolled===6?'No valid move. Roll again!':'No valid moves. Turn passes.';
      diceButton.disabled=true; busy=true;
      window.setTimeout(()=>{busy=false;nextPlayer(rolled===6);},850);
      return;
    }
    gameMessage.textContent=moves.length===1
      ? (moves[0].progress===-1?'Choose the token you want to bring out.':'Choose the highlighted token to move.')
      : (rolled===6?'A six! Choose a token to move.':'Choose one of the glowing tokens.');
    diceButton.disabled=true; renderTokens(moves);
  }
  const pause = ms => new Promise(resolve=>window.setTimeout(resolve,ms));
  async function moveToken(player,token) {
    if (!running||player!==players[current]||rolled===null||busy) return;
    busy=true;
    const six=rolled===6;
    const fromYard=token.progress===-1;
    const steps=fromYard?1:rolled;
    for (let step=0;step<steps;step++) {
      if(fromYard) token.progress=0;
      else token.progress++;
      renderTokens();
      await pause(180);
    }
    busy=false;
    let captured=0;
    if (token.progress<52) {
      const landing=(starts[player.color]+token.progress)%52;
      if (!safeIndices.includes(landing)) for (const opponent of players) if (opponent!==player) {
        for (const other of opponent.tokens) if (other.progress>=0&&other.progress<52&&(starts[opponent.color]+other.progress)%52===landing) { other.progress=-1;captured++; }
      }
    }
    rolled=null; diceButton.disabled=false;
    if (player.tokens.every(t=>t.progress===57)) {
      gameMessage.textContent=`${names[player.color]} wins! All four tokens made it home.`;
      turnIndicator.textContent='WINNER'; running=false; diceButton.disabled=true; renderPlayers(); renderTokens(); return;
    }
    if (token.progress===57) gameMessage.textContent='Home! You need an exact roll. Roll again!';
    else if (captured) gameMessage.textContent=`Captured ${captured} token${captured>1?'s':''}! Roll again.`;
    else if (six) gameMessage.textContent='A six! Roll again.';
    else gameMessage.textContent='Nice move. Roll the dice.';
    renderPlayers(); renderTokens();
    const extra=six||captured>0||token.progress===57;
    if (extra) { diceButton.disabled=false; }
    else nextPlayer();
  }
  document.querySelectorAll('.count-option').forEach(button=>button.addEventListener('click',()=>{
    playerCount=Number(button.dataset.count);
    colorSelection.hidden=playerCount!==2;
    document.querySelectorAll('.count-option').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
  }));
  document.getElementById('startButton').addEventListener('click',startGame);
  document.getElementById('newGameButton').addEventListener('click',()=>{running=false;rolled=null;busy=false;setupCard.hidden=false;turnCard.hidden=true;players=[];playerList.replaceChildren();tokensEl.replaceChildren();tokenElements.clear();turnIndicator.textContent='READY';});
  diceButton.addEventListener('click',rollDice);
  // The geometric route should contain exactly one instance of each of the 52 track cells.
  if (uniqueRoute.length !== 52) console.warn(`Ludo track has ${uniqueRoute.length} spaces; expected 52.`);
  renderPlayers();
})();
