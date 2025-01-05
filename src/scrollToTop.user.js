// ==UserScript==
// @name            [LSS] Scroll-To-Top buttons
// @namespace       https://jxn.lss-manager.de
// @version         2024.12.31+1938
// @author          Jan (jxn_30)
// @description     Shows a scroll-to-top button on all scrollable elements
// @description:de  Zeigt einen Knopf, um in Elementen nach oben zu scrollen
// @homepage        https://github.com/jxn-30/LSS-Scripts
// @homepageURL     https://github.com/jxn-30/LSS-Scripts
// @icon            https://www.leitstellenspiel.de/favicon.ico
// @updateURL       https://github.com/jxn-30/LSS-Scripts/raw/master/src/scrollToTop.user.js
// @downloadURL     https://github.com/jxn-30/LSS-Scripts/raw/master/src/scrollToTop.user.js
// @supportURL      https://forum.leitstellenspiel.de/index.php?thread/22254-scriptwunsch-pfeil-oder-button-zum-seitenanfang-bzw-seitenende/
// @match           https://www.operacni-stredisko.cz/*
// @match           https://policie.operacni-stredisko.cz/*
// @match           https://www.alarmcentral-spil.dk/*
// @match           https://politi.alarmcentral-spil.dk/*
// @match           https://www.leitstellenspiel.de/*
// @match           https://polizei.leitstellenspiel.de/*
// @match           https://www.missionchief-australia.com/*
// @match           https://police.missionchief-australia.com/*
// @match           https://www.missionchief.co.uk/*
// @match           https://police.missionchief.co.uk/*
// @match           https://www.missionchief.com/*
// @match           https://police.missionchief.com/*
// @match           https://www.centro-de-mando.es/*
// @match           https://www.centro-de-mando.mx/*
// @match           https://www.hatakeskuspeli.com/*
// @match           https://poliisi.hatakeskuspeli.com/*
// @match           https://www.operateur112.fr/*
// @match           https://police.operateur112.fr/*
// @match           https://www.operatore112.it/*
// @match           https://polizia.operatore112.it/*
// @match           https://www.missionchief-japan.com/*
// @match           https://www.missionchief-korea.com/*
// @match           https://www.nodsentralspillet.com/*
// @match           https://politiet.nodsentralspillet.com/*
// @match           https://www.meldkamerspel.com/*
// @match           https://politie.meldkamerspel.com/*
// @match           https://www.operatorratunkowy.pl/*
// @match           https://policja.operatorratunkowy.pl/*
// @match           https://www.operador193.com/*
// @match           https://www.jogo-operador112.com/*
// @match           https://policia.jogo-operador112.com/*
// @match           https://www.jocdispecerat112.com/*
// @match           https://www.dispetcher112.ru/*
// @match           https://www.dispecerske-centrum.com/*
// @match           https://www.larmcentralen-spelet.se/*
// @match           https://polis.larmcentralen-spelet.se/*
// @match           https://www.112-merkez.com/*
// @match           https://www.dyspetcher101-game.com/*
// @run-at          document-idle
// @grant           GM_addStyle
// ==/UserScript==

/**
 * @name Scroll-To-Top buttons
 * @description Shows a scroll-to-top button on all scrollable elements
 * @description:de Zeigt einen Knopf, um in Elementen nach oben zu scrollen
 * @forum https://forum.leitstellenspiel.de/index.php?thread/22254-scriptwunsch-pfeil-oder-button-zum-seitenanfang-bzw-seitenende/
 * @grant GM_addStyle
 */

const hideTimeouts = {};
const hideAfter = 1;

GM_addStyle(`
.scroll-to-top-btn {
    position: sticky;
    bottom: 1em;
    right: 1em;
    z-index: 10000;
    float: right;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 50px;
    height: 100px;
}
.scroll-to-top-btn .half {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
}
.scroll-to-top-btn .half:hover {
    background-color: rgba(0, 0, 0, 0.1);
}
`);

if (!window.frameElement || window.frameElement?.src?.startsWith('https://')) {
    document.addEventListener(
        'scroll',
        e => {
            const target = e.target;
            const targetIsDocument = target instanceof HTMLDocument;
            if (!(target instanceof HTMLElement) && !targetIsDocument) return;
            if (target instanceof HTMLInputElement) return;

            const targetOrDocEl =
                targetIsDocument ? document.documentElement : target;

            const showScrollToTop = targetOrDocEl.scrollTop > 50;
            let scrollToTopBtn = (
                targetIsDocument ?
                    document.body
                :   target).querySelector(':scope > .scroll-to-top-btn');
            if (!scrollToTopBtn) {
                scrollToTopBtn = document.createElement('div');
                scrollToTopBtn.classList.add(
                    'scroll-to-top-btn',
                    'btn',
                    'btn-default'
                );

                const topHalf = document.createElement('div');
                topHalf.classList.add('half');
                topHalf.textContent = '↑';
                topHalf.addEventListener('click', e => {
                    e.preventDefault();
                    targetOrDocEl.scrollTo({ top: 0, behavior: 'smooth' });
                });

                const bottomHalf = document.createElement('div');
                bottomHalf.classList.add('half');
                bottomHalf.textContent = '↓';
                bottomHalf.addEventListener('click', e => {
                    e.preventDefault();
                    targetOrDocEl.scrollTo({ top: targetOrDocEl.scrollHeight, behavior: 'smooth' });
                });

                scrollToTopBtn.append(topHalf, bottomHalf);

                if (targetIsDocument) document.body.append(scrollToTopBtn);
                else target.append(scrollToTopBtn);
                let translateY = parseFloat(
                    getComputedStyle(targetOrDocEl).paddingBottom
                );
                if (
                    targetIsDocument &&
                    document.querySelector(
                        '.navbar-fixed-bottom:not(#navbar-mobile-footer)'
                    )
                ) {
                    translateY -= 50;
                }
                const personalOvertakeCounter = document.querySelector(
                    '#personal_hire_overtake_counter'
                );
                const translateX =
                    0 -
                    (personalOvertakeCounter ?
                        parseFloat(
                            getComputedStyle(personalOvertakeCounter).width
                        )
                    :   0);
                scrollToTopBtn.style.setProperty(
                    'transform',
                    `translate(${translateX}px, ${translateY}px)`
                );
            }
            scrollToTopBtn.classList[showScrollToTop ? 'remove' : 'add'](
                'hidden'
            );

            if (hideTimeouts[targetOrDocEl]) {
                window.clearTimeout(hideTimeouts[targetOrDocEl]);
            }
            hideTimeouts[targetOrDocEl] = window.setTimeout(
                () => scrollToTopBtn.classList.add('hidden'),
                hideAfter * 1000
            );
        },
        { capture: true }
    );
}
