/* Аник — отрисовка теории смысловыми блоками: Главное → Правило → Формулы → Как решать → Пример → Исключения → Ловушки.
   Общая для rus-ege.html, math.html и trainer.html. Данные не меняет — только раскладывает их по блокам (стили — anik.css, раздел «теория блоками»).
   Пустые блоки не показываются. Необязательное поле key — главная мысль одной фразой; если его нет, «Главное» — первый абзац правила. */
(function(){
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function arr(x){return Array.isArray(x)?x.filter(function(s){return s!=null&&String(s).trim()!=='';}):(x&&String(x).trim()?[x]:[]);}
  var ICON={key:'★',rule:'§',form:'ƒ',how:'→',ex:'✎',exc:'≠',trap:'!',tip:'✓',note:'i'};

  function block(kind,label,inner){
    return '<section class="thb thb-'+kind+'"><div class="thb-h"><i aria-hidden="true">'+ICON[kind]+'</i>'+label+'</div>'+inner+'</section>';
  }
  function list(items,cls){return '<ul class="thb-list'+(cls?' '+cls:'')+'">'+items.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul>';}

  // первое предложение длинного абзаца — жирнее: глаз цепляется за суть, остальное читается как пояснение
  function lead(html){
    var re=/[.!?…](?=\s+[«"(—А-ЯЁA-Z0-9$])/g,m;
    while((m=re.exec(html))){
      var i=m.index+1,head=html.slice(0,i);
      if((head.match(/\$/g)||[]).length%2)continue;          // точка внутри формулы
      if(/(?:^|\s)(?:т|е|т\.\s?е|т\.\s?к|т\.\s?д|т\.\s?п|см|др|пр|им|род|дат|вин|тв|предл|ед|мн|ч|ж|м|ср|р|с|г|в|н|э|рис)\.$/i.test(head))continue;  // сокращение
      if(i<18||i>170)return html;
      if(html.length-i<30)return html;
      return '<b class="thb-lead">'+head+'</b>'+html.slice(i);
    }
    return html;
  }

  // формула: «$…$ (подпись)» или «$…$, где …» → формула крупно, подпись словами ниже
  function formula(s,fmt){
    s=String(s).trim();var m,fx=s,cap='';
    if((m=/^(\$[^$]+\$)\s*\(([^()]+)\)\s*\.?$/.exec(s))){fx=m[1];cap=m[2];}
    else if((m=/^(\$[^$]+\$)\s*[,—–-]\s*(где\s.+)$/.exec(s))){fx=m[1];cap=m[2];}
    var txt=s.charAt(0)!=='$';
    return '<div class="thb-f"><div class="thb-fx'+(txt?' txt':'')+'">'+fmt(fx)+'</div>'+(cap?'<div class="thb-fc">'+fmt(cap)+'</div>':'')+'</div>';
  }

  /* Тема целиком. t: {key, rule[], formulas[], steps[], ex[] | example{t,s[],a}, exc[], traps[], tip}
     o: {fmt: строка → безопасный html (по умолчанию экранирование), exFmt: для строк-примеров, stepsLabel, exLabel} */
  function topic(t,o){
    o=o||{};var fmt=o.fmt||esc,exFmt=o.exFmt||fmt,h='';
    var rule=arr(t.rule),key=t.key&&String(t.key).trim()?t.key:'',own=!!key;
    if(!key&&rule.length){key=rule[0];rule=rule.slice(1);}
    // своё поле key — одна фраза, её крупно и жирно; первый абзац правила вместо него — крупно, но без жирного (он длиннее)
    if(key)h+=block('key','Главное','<p class="thb-big'+(own?'':' thb-soft')+'">'+fmt(key)+'</p>');
    if(rule.length)h+=block('rule',o.ruleLabel||'Правило',rule.length===1?'<p>'+lead(fmt(rule[0]))+'</p>':list(rule.map(function(p){return lead(fmt(p));})));
    var fs=arr(t.formulas);
    if(fs.length)h+=block('form','Формулы','<div class="thb-fs">'+fs.map(function(f){return formula(f,fmt);}).join('')+'</div>');
    var st=arr(t.steps);
    if(st.length)h+=block('how',o.stepsLabel||'Как решать','<ol class="thb-steps">'+st.map(function(s){return '<li>'+fmt(s)+'</li>';}).join('')+'</ol>');
    var ex=arr(t.ex);
    if(ex.length)h+=block('ex',o.exLabel||(ex.length>1?'Примеры':'Пример'),ex.map(function(x){return '<div class="thb-plate">'+exFmt(x)+'</div>';}).join(''));
    var e=t.example;
    if(e&&e.t){
      var sx=arr(e.s);
      h+=block('ex',o.exLabel||'Пример','<div class="thb-plate"><div class="thb-task">'+fmt(e.t)+'</div>'
        +(sx.length?'<ol class="thb-steps thb-sm">'+sx.map(function(s){return '<li>'+fmt(s)+'</li>';}).join('')+'</ol>':'')
        +(e.a!=null&&String(e.a)!==''?'<div class="thb-ans">Ответ: <b>'+fmt(e.a)+'</b></div>':'')+'</div>');
    }
    var xc=arr(t.exc);
    if(xc.length)h+=block('exc','Исключения — запомнить',list(xc.map(fmt)));
    var tr=arr(t.traps);
    if(tr.length)h+=block('trap',o.trapLabel||'Ловушки: частые ошибки',list(tr.map(fmt)));
    if(t.tip)h+=block('tip','Совет','<p>'+fmt(t.tip)+'</p>');
    return '<div class="thb-wrap">'+h+'</div>';
  }

  /* Карточка вида {title, content, rules:[{r,t,ex}], tip, warn} (вкладка «Теория» русского ЕГЭ и теория ОГЭ).
     o: {html: true — content/rules уже html (русский ЕГЭ), иначе экранируем; exFmt — для примеров} */
  function splitTip(s,prefix){
    s=String(s).replace(prefix,'').trim();
    return s.split(/;\s+(?=[А-ЯЁA-Z«])/).map(function(x){return x.replace(/[.;]+$/,'').trim();}).filter(Boolean);
  }
  function card(c,o){
    o=o||{};
    var fmt=o.html?function(s){return String(s);}:esc,exFmt=o.exFmt||fmt,h='';
    var paras=o.html?String(c.content||'').split(/<\/p>\s*<p>/i):[c.content||''];
    paras=paras.map(function(s){return s.trim();}).filter(Boolean);
    if(paras.length)h+=block('key','Главное','<p class="thb-big thb-soft">'+fmt(paras[0])+'</p>');
    if(paras.length>1)h+=block('rule','Правило',list(paras.slice(1).map(function(p){return lead(fmt(p));})));
    var rs=c.rules||[];
    rs.forEach(function(r){
      var t=String(r.t||''),lines=o.html?t.split(/<br\s*\/?>/i):[t];
      lines=lines.map(function(s){return s.trim();}).filter(Boolean);
      var numbered=lines.length>1&&lines.every(function(l){return /^\d+[.)]\s/.test(l);});
      var body=numbered?'<ol class="thb-steps">'+lines.map(function(l){return '<li>'+fmt(l.replace(/^\d+[.)]\s*/,''))+'</li>';}).join('')+'</ol>'
        :lines.map(function(l){return '<p>'+fmt(l)+'</p>';}).join('');
      var ex=arr(r.ex);
      // класс rbox оставлен: на него опираются тесты тренажёра
      h+='<div class="rbox thb-r"><div class="thb-rn">'+fmt(r.r)+'</div>'+body
        +(ex.length?'<div class="thb-exs">'+ex.map(function(x){return '<span class="thb-chip">'+exFmt(x)+'</span>';}).join('')+'</div>':'')+'</div>';
    });
    if(c.tip){
      if(/^Частые ошибки:/i.test(c.tip))h+=block('trap','Ловушки: частые ошибки',list(splitTip(c.tip,/^Частые ошибки:\s*/i).map(fmt)));
      else h+=block('tip','Совет','<p>'+fmt(c.tip)+'</p>');
    }
    if(c.warn){
      if(/^Исключения/i.test(c.warn)){var m=/^[^:]*:\s*([\s\S]*)$/.exec(c.warn);h+=block('exc','Исключения — запомнить',m?list(splitTip(m[1],'').map(fmt)):'<p>'+fmt(c.warn)+'</p>');}
      else h+=block('trap','Осторожно','<p>'+fmt(c.warn)+'</p>');
    }
    return '<div class="thb-wrap">'+h+'</div>';
  }

  // русский: «_» — пропуск буквы, «→» — шаг рассуждения
  function rusFmt(s){
    // слово с пропуском не рвём на две строки
    return esc(s).replace(/[^\s<>]*_[^\s<>]*/g,function(w){return '<span class="thb-w">'+w.replace(/_/g,'<span class="thb-gap">_</span>')+'</span>';}).replace(/\s→\s/g,' <span class="thb-arr">→</span> ');
  }

  // после KaTeX: знак препинания сразу за формулой не должен уезжать на новую строку
  function glue(el){
    if(!el)return;
    [].forEach.call(el.querySelectorAll('.katex'),function(k){
      if(k.parentElement.closest('.katex')||k.closest('.katex-display')||k.closest('.nobr'))return;
      if(k.parentNode.childNodes.length===1&&k.parentNode.tagName==='SPAN')k=k.parentNode;   // обёртка auto-render
      var t=k.nextSibling;if(!t||t.nodeType!==3)return;
      var m=t.data.match(/^[.,;:!?)»]+/);if(!m)return;
      var w=document.createElement('span');w.className='nobr';w.style.whiteSpace='nowrap';
      k.parentNode.insertBefore(w,k);w.appendChild(k);w.appendChild(document.createTextNode(m[0]));t.data=t.data.slice(m[0].length);
    });
  }

  window.AnikTheory={topic:topic,card:card,block:block,formula:formula,esc:esc,rusFmt:rusFmt,lead:lead,glue:glue};
})();
