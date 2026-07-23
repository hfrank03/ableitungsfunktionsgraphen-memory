(function(){
  // ---------- Polynom-Hilfsfunktionen ----------
  // Polynom als Koeffizienten-Array, Index = Grad des Terms: coeffs[i] -> Koeffizient von x^i
  function derivative(coeffs){
    const d = [];
    for(let i=1;i<coeffs.length;i++){
      d.push(coeffs[i]*i);
    }
    if(d.length===0) d.push(0);
    return d;
  }

  function evalPoly(coeffs, x){
    let sum = 0;
    for(let i=0;i<coeffs.length;i++){
      sum += coeffs[i]*Math.pow(x,i);
    }
    return sum;
  }

  function polyToLatexLike(coeffs){
    // nur intern zur Eindeutigkeit, nicht angezeigt
    return coeffs.join(',');
  }

  // ---------- "Schöne" Polynome Grad 2 bis 5 erzeugen ----------
  // Statt zufälliger Koeffizienten je Term: Konstruktion über einfache,
  // ganzzahlige Nullstellen -> ruhigere, gut erkennbare Graphen.
  function randInt(min,max){
    return Math.floor(Math.random()*(max-min+1))+min;
  }

  // Multipliziert zwei Polynome (Koeffizienten-Arrays, Index = Grad)
  function multiplyPoly(a,b){
    const result = new Array(a.length+b.length-1).fill(0);
    for(let i=0;i<a.length;i++){
      for(let j=0;j<b.length;j++){
        result[i+j]+=a[i]*b[j];
      }
    }
    return result;
  }

  function generatePolynomial(degree){
    // kleine, ruhige Leitkoeffizienten fuer besonders einfache, gut
    // erkennbare Kurvenformen
    const leadOptions = degree<=2 ? [1,1,1,-1,-1] :
                                     [1,1,-1]; // Grad 3
    let leadCoeff = leadOptions[randInt(0,leadOptions.length-1)];

    // Nullstellen aus einer kleinen, engen Menge waehlen -> sanftere,
    // einfachere Kurvenverlaeufe
    const rootPool = [-2,-1,-1,0,0,0,1,1,2];
    let roots = [];
    let usedCount = {};
    let tries = 0;
    while(roots.length < degree && tries < 200){
      tries++;
      const r = rootPool[randInt(0,rootPool.length-1)];
      const c = usedCount[r] || 0;
      if(c>=2) continue;
      usedCount[r]=c+1;
      roots.push(r);
    }
    while(roots.length < degree){
      roots.push(randInt(-2,2));
    }

    // Polynom aus Nullstellen aufbauen: leadCoeff * Produkt (x - r_i)
    let poly = [leadCoeff];
    roots.forEach(r=>{
      poly = multiplyPoly(poly, [-r, 1]); // entspricht Faktor (x - r)
    });

    // sehr leichte vertikale Verschiebung fuer Abwechslung (ganzzahlig, klein)
    if(Math.random()<0.5){
      poly[0] += randInt(-1,1);
    }

    poly = poly.map(c=> Math.round(c*100)/100);

    return poly;
  }

  function generateUniquePairs(count){
    const pairs = [];
    const seenKeys = new Set();
    const acceptedShapes = []; // normalisierte Kurvenformen aller bereits vergebenen Karten
    const SIMILARITY_THRESHOLD = 0.0025; // je kleiner, desto strenger

    let attempts = 0;
    // Nur Grad 2 (Parabeln) und Grad 3 (einfache Kubiken) fuer einfachere Formen
    const degreeCycle = [2,3];
    let cycleIdx = 0;
    while(pairs.length < count && attempts < 4000){
      attempts++;
      const degree = degreeCycle[cycleIdx % degreeCycle.length];
      const f = generatePolynomial(degree);
      const key = polyToLatexLike(f);
      if(seenKeys.has(key)) continue;

      const fp = derivative(f);
      const shapeF = normalizedShape(f);
      const shapeFp = normalizedShape(fp);

      // f und f' duerfen sich selbst nicht zum Verwechseln aehnlich sehen
      if(shapesSimilar(shapeF, shapeFp, SIMILARITY_THRESHOLD)) continue;

      // Gegen ALLE bereits vergebenen Karten pruefen (f- und f'-Karten
      // gemischt), damit wirklich jede Karte im Feld eindeutig ihrem
      // Partner zuordenbar ist
      let clashes = false;
      for(const s of acceptedShapes){
        if(shapesSimilar(shapeF, s, SIMILARITY_THRESHOLD) || shapesSimilar(shapeFp, s, SIMILARITY_THRESHOLD)){
          clashes = true;
          break;
        }
      }
      if(clashes) continue;

      seenKeys.add(key);
      acceptedShapes.push(shapeF, shapeFp);
      pairs.push({f, fp, degree});
      cycleIdx++;
    }

    // Fallback: falls trotz vieler Versuche nicht genug eindeutige Paare
    // gefunden wurden (sollte praktisch nicht vorkommen), Schwelle lockern
    if(pairs.length >= count){
      return pairs;
    }

    let progress = generateUniquePairsRelaxed(count, pairs, seenKeys, acceptedShapes);
    if(progress.length >= count){
      return progress.slice(0, count);
    }

    // Letztes, hartes Sicherheitsnetz: aus einer fest hinterlegten Liste
    // garantiert unterschiedlich geformter Polynome auffuellen, bis exakt
    // `count` Paare erreicht sind. So bleibt IMMER eine gerade Kartenzahl
    // ohne uebrig bleibende Einzelkarte bestehen.
    const finalPairs = fillWithHardcodedFallback(
      count,
      progress,
      new Set(progress.map(p=>polyToLatexLike(p.f))),
      progress.flatMap(p=>[normalizedShape(p.f), normalizedShape(p.fp)])
    );
    return finalPairs.slice(0, count);
  }

  function generateUniquePairsRelaxed(count, existingPairs, existingSeenKeys, existingShapes){
    // Abgeschwächte Variante: Formschwelle lockern, aber weiterhin auf den
    // bereits akzeptierten Paaren aufbauen statt bei 0 neu zu starten
    const pairs = existingPairs.slice();
    const seen = new Set(existingSeenKeys);
    const acceptedShapes = existingShapes.slice();
    const RELAXED_THRESHOLD = 0.0008; // strenger als vorher gelockert gemeint als Mindestabstand
    let attempts = 0;
    const degreeCycle = [2,3];
    let cycleIdx = 0;
    while(pairs.length < count && attempts < 3000){
      attempts++;
      const degree = degreeCycle[cycleIdx % degreeCycle.length];
      const f = generatePolynomial(degree);
      const key = polyToLatexLike(f);
      if(seen.has(key)){ cycleIdx++; continue; }
      const fp = derivative(f);
      const shapeF = normalizedShape(f);
      const shapeFp = normalizedShape(fp);
      let clashes = shapesSimilar(shapeF, shapeFp, RELAXED_THRESHOLD);
      if(!clashes){
        for(const s of acceptedShapes){
          if(shapesSimilar(shapeF, s, RELAXED_THRESHOLD) || shapesSimilar(shapeFp, s, RELAXED_THRESHOLD)){
            clashes = true; break;
          }
        }
      }
      if(clashes){ cycleIdx++; continue; }
      seen.add(key);
      acceptedShapes.push(shapeF, shapeFp);
      pairs.push({f, fp, degree});
      cycleIdx++;
    }
    return pairs;
  }

  // Fest hinterlegte, garantiert unterschiedlich geformte, einfache Polynome
  // (Grad 2 und 3) als allerletztes Sicherheitsnetz, damit die Kartenanzahl
  // niemals ungerade wird bzw. Paare fehlen.
  const HARDCODED_FALLBACK_F = [
    [0,0,1],            // x^2
    [-4,0,1],           // x^2 - 4
    [1,0,-1],           // -x^2 + 1
    [0,0,0,1],          // x^3
    [0,-3,0,1],         // x^3 - 3x
    [0,1,0,-1]          // -x^3 + x
  ];

  function fillWithHardcodedFallback(count, existingPairs, existingSeenKeys, existingShapes){
    const pairs = existingPairs.slice();
    const seen = new Set(existingSeenKeys);
    const acceptedShapes = existingShapes.slice();

    for(const f of HARDCODED_FALLBACK_F){
      if(pairs.length >= count) break;
      const key = polyToLatexLike(f);
      if(seen.has(key)) continue;
      const fp = derivative(f);
      const shapeF = normalizedShape(f);
      const shapeFp = normalizedShape(fp);
      seen.add(key);
      acceptedShapes.push(shapeF, shapeFp);
      pairs.push({f, fp, degree: f.length-1});
    }

    // Absolute Notlösung: sollte selbst die feste Liste nicht reichen,
    // einfache, garantiert eindeutige Vielfache von x^2 ergänzen, damit
    // in jedem Fall exakt `count` Paare (= gerade Kartenzahl) entstehen.
    let m = 3;
    while(pairs.length < count){
      const f = [0,0,m];
      const key = polyToLatexLike(f);
      if(!seen.has(key)){
        seen.add(key);
        pairs.push({f, fp: derivative(f), degree: 2});
      }
      m++;
    }
    return pairs;
  }

  // Tastet eine Kurve im dargestellten Bereich ab und normalisiert sie auf
  // [0,1], genau wie sie im Kartenrahmen mit automatischer Achsenskalierung
  // gezeichnet wird. So laesst sich pruefen, ob zwei Karten am Ende optisch
  // ununterscheidbar waeren.
  function normalizedShape(coeffs){
    const N = 40;
    const xMin=-3, xMax=3;
    const ys = [];
    for(let i=0;i<=N;i++){
      const x = xMin + (xMax-xMin)*i/N;
      ys.push(evalPoly(coeffs, x));
    }
    let yMin = Math.min(...ys), yMax = Math.max(...ys);
    const range = (yMax-yMin) || 1;
    return ys.map(y => (y-yMin)/range);
  }

  function shapesSimilar(a, b, threshold){
    let sum = 0;
    for(let i=0;i<a.length;i++){
      const d = a[i]-b[i];
      sum += d*d;
    }
    const mse = sum/a.length;
    return mse < threshold;
  }

  // ---------- SVG Graph-Rendering ----------
  const VB = 200, VB_H = 200;
  function buildGraphSVG(coeffs, color){
    const xMin=-3, xMax=3;
    const N=80;
    let pts=[];
    for(let i=0;i<=N;i++){
      const x = xMin + (xMax-xMin)*i/N;
      const y = evalPoly(coeffs, x);
      pts.push([x,y]);
    }
    let yMin = Math.min(...pts.map(p=>p[1]));
    let yMax = Math.max(...pts.map(p=>p[1]));
    if(yMax-yMin < 0.5){ yMax+=1; yMin-=1; }
    const padY = (yMax-yMin)*0.12;
    yMin -= padY; yMax += padY;

    const padPx = 18;
    function sx(x){ return padPx + (x-xMin)/(xMax-xMin) * (VB-2*padPx); }
    function sy(y){ return VB_H-padPx - (y-yMin)/(yMax-yMin) * (VB_H-2*padPx); }

    const pathD = pts.map((p,i)=>{
      return (i===0?'M':'L') + sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1);
    }).join(' ');

    // Achsen
    let axesEls = '';
    if(0>=xMin && 0<=xMax){
      const x0 = sx(0);
      axesEls += `<line x1="${x0}" y1="${padPx}" x2="${x0}" y2="${VB_H-padPx}" stroke="#c9d2d6" stroke-width="1"/>`;
    }
    if(0>=yMin && 0<=yMax){
      const y0 = sy(0);
      axesEls += `<line x1="${padPx}" y1="${y0}" x2="${VB-padPx}" y2="${y0}" stroke="#c9d2d6" stroke-width="1"/>`;
    }

    return `<svg viewBox="0 0 ${VB} ${VB_H}" xmlns="http://www.w3.org/2000/svg">
      ${axesEls}
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  // ---------- Mathematische Formeldarstellung via KaTeX ----------
  function renderMath(tex){
    if(window.katex){
      try{
        return katex.renderToString(tex, { throwOnError:false });
      }catch(e){ /* Fallback unten */ }
    }
    return tex; // Fallback: einfacher Text, falls KaTeX nicht verfuegbar ist
  }

  // ---------- Spiel-Setup ----------
  const PAIR_COUNT = 6; // 6 Paare = 12 Karten (3x4-Feld)
  const TEAL = '#1C6D87';
  const TAN = '#E1B37B';

  let cards = [];
  let flipped = [];
  let lock = false;
  let scores = [0,0];
  let currentPlayer = 0;
  let matchedPairs = 0;

  const gridEl = document.getElementById('grid');
  const turnIndicator = document.getElementById('turnIndicator');
  const turnText = document.getElementById('turnText');
  const p1card = document.getElementById('p1card');
  const p2card = document.getElementById('p2card');
  const p1score = document.getElementById('p1score');
  const p2score = document.getElementById('p2score');
  const winOverlay = document.getElementById('winOverlay');
  const winMessage = document.getElementById('winMessage');
  const winNewGameBtn = document.getElementById('winNewGameBtn');

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function buildCards(){
    const pairs = generateUniquePairs(PAIR_COUNT);
    let deck = [];
    pairs.forEach((pair, idx)=>{
      deck.push({
        pairId: idx,
        type: 'f',
        coeffs: pair.f,
        color: TEAL
      });
      deck.push({
        pairId: idx,
        type: 'fp',
        coeffs: pair.fp,
        color: TAN
      });
    });
    shuffle(deck);
    return deck;
  }

  function render(){
    gridEl.innerHTML = '';
    cards.forEach((cardData, i)=>{
      const cardEl = document.createElement('div');
      cardEl.className = 'card type-' + cardData.type;
      cardEl.dataset.index = i;

      const inner = document.createElement('div');
      inner.className = 'card-inner';

      const back = document.createElement('div');
      back.className = 'card-face card-back';
      back.innerHTML = cardData.type==='f'
        ? renderMath('f(x)')
        : renderMath("f'(x)");

      const front = document.createElement('div');
      front.className = 'card-face card-front';
      front.innerHTML = buildGraphSVG(cardData.coeffs, cardData.color);

      inner.appendChild(back);
      inner.appendChild(front);
      cardEl.appendChild(inner);
      cardEl.addEventListener('click', ()=>onCardClick(i));
      gridEl.appendChild(cardEl);
    });
  }

  function updateScoreboard(){
    p1score.textContent = scores[0] + (scores[0]===1?' Paar':' Paare');
    p2score.textContent = scores[1] + (scores[1]===1?' Paar':' Paare');
    p1card.classList.toggle('active', currentPlayer===0);
    p2card.classList.toggle('active', currentPlayer===1);
    turnText.textContent = 'Spieler ' + (currentPlayer+1) + ' ist am Zug';
  }

  function onCardClick(i){
    if(lock) return;
    const cardEl = gridEl.children[i];
    if(cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;
    if(flipped.length===2) return;

    cardEl.classList.add('flipped');
    flipped.push(i);

    if(flipped.length===2){
      lock = true;
      const [i1,i2] = flipped;
      const c1 = cards[i1], c2 = cards[i2];
      const isMatch = c1.pairId === c2.pairId && c1.type !== c2.type;

      if(isMatch){
        setTimeout(()=>{
          gridEl.children[i1].classList.add('matched');
          gridEl.children[i2].classList.add('matched');
          scores[currentPlayer]++;
          matchedPairs++;
          flipped = [];
          lock = false;
          updateScoreboard();
          checkWin();
        }, 550);
      } else {
        setTimeout(()=>{
          gridEl.children[i1].classList.remove('flipped');
          gridEl.children[i2].classList.remove('flipped');
          flipped = [];
          lock = false;
          currentPlayer = 1 - currentPlayer;
          updateScoreboard();
        }, 1000);
      }
    }
  }

  function checkWin(){
    if(matchedPairs === PAIR_COUNT){
      let msg;
      if(scores[0] > scores[1]) msg = '🎉 Spieler 1 gewinnt mit ' + scores[0] + ' zu ' + scores[1] + ' Paaren!';
      else if(scores[1] > scores[0]) msg = '🎉 Spieler 2 gewinnt mit ' + scores[1] + ' zu ' + scores[0] + ' Paaren!';
      else msg = '🤝 Unentschieden! Beide haben ' + scores[0] + ' Paare gefunden.';
      winMessage.textContent = msg;
      winOverlay.classList.add('visible');
    }
  }

  function startNewGame(){
    document.getElementById('subtitleF').innerHTML = renderMath('f(x)');
    document.getElementById('subtitleFp').innerHTML = renderMath("f'(x)");
    cards = buildCards();
    flipped = [];
    lock = false;
    scores = [0,0];
    currentPlayer = 0;
    matchedPairs = 0;
    winOverlay.classList.remove('visible');
    updateScoreboard();
    render();
  }

  
  
  // Klick auf den abgedunkelten Hintergrund schließt das Popup, ohne
  // gleich ein neues Spiel zu starten
  winOverlay.addEventListener('click', (e)=>{
    if(e.target === winOverlay) winOverlay.classList.remove('visible');
  });

  winNewGameBtn.addEventListener('click', startNewGame);

  startNewGame();
})();
