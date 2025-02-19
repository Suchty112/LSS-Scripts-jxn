// ==UserScript==
// @name            [LSS] Forum: Old Like Style
// @namespace       https://jxn.lss-manager.de
// @version         2025.02.19+1550
// @author          Jan (jxn_30)
// @description     Re-enables the old style of likes in the forum (displays summary on top of post & react without opening the reaction menu)
// @description:de  Stellt den alten Like-Style im Forum wieder her (zeigt die Likes oben im Post an und ermöglicht das Liken, ohne das Reaktionen-Menü zu öffnen)
// @homepage        https://github.com/jxn-30/LSS-Scripts
// @homepageURL     https://github.com/jxn-30/LSS-Scripts
// @icon            https://www.leitstellenspiel.de/favicon.ico
// @updateURL       https://github.com/jxn-30/LSS-Scripts/raw/master/src/forum/oldLikeStyle.user.js
// @downloadURL     https://github.com/jxn-30/LSS-Scripts/raw/master/src/forum/oldLikeStyle.user.js
// @supportURL      https://forum.leitstellenspiel.de/index.php?thread/23913-forum-alter-like-style/
// @match           https://forum.leitstellenspiel.de/*
// @run-at          document-idle
// @grant           GM_addStyle
// @grant           unsafeWindow
// ==/UserScript==

/**
 * @name Forum: Old Like Style
 * @description Re-enables the old style of likes in the forum (displays summary on top of post & react without opening the reaction menu)
 * @description:de Stellt den alten Like-Style im Forum wieder her (zeigt die Likes oben im Post an und ermöglicht das Liken, ohne das Reaktionen-Menü zu öffnen)
 * @forum https://forum.leitstellenspiel.de/index.php?thread/23913-forum-alter-like-style/
 * @match /*
 * @locale de_DE
 * @subdomain forum
 * @grant GM_addStyle
 * @grant unsafeWindow
 */

/* global require */

// ----------------------------
// constants used in the script
const LIKE_REACTION_ID = 1;
const LIKES_ELEMENT_CLASS = 'jxn-likes-li-element';

// --------------------------------
// copy likes status to top of post

/**
 *
 * @param {HTMLLIElement} element
 * @param {number} amount
 */
const updateLikesElement = (element, amount) => {
    element.dataset.likes = amount.toString();
    const valueElement = element.querySelector('.wcfLikeValue');
    if (valueElement) {
        valueElement.textContent = amount.toLocaleString('de-DE', {
            signDisplay: 'exceptZero',
        });
    }
    const link = element.querySelector('.wcfLikeCounter');
    if (link) {
        if (amount > 0) {
            link.classList.add('likeCounterLiked');
            link.classList.remove('likeCounterDisliked');
        } else if (amount < 0) {
            link.classList.add('likeCounterDisliked');
            link.classList.remove('likeCounterLiked');
        } else {
            link.classList.remove('likeCounterLiked', 'likeCounterDisliked');
        }
    }
};

document
    .querySelectorAll('woltlab-core-reaction-summary')
    .forEach(summaryList => {
        /** @type {HTMLDivElement | null} **/
        const messageContent = summaryList.closest('.messageContent');

        /** @type {HTMLUListElement | null} **/
        const messageStatus = messageContent?.querySelector(
            '.messageHeader > .messageHeaderBox > .messageStatus'
        );
        if (!messageStatus) return;

        const likesAmount = parseInt(
            summaryList
                .querySelector(
                    `.reactionCountButton:has([data-reaction-type-id="${LIKE_REACTION_ID}"]) .reactionCount`
                )
                ?.textContent?.trim() ?? '0'
        );

        const likesElement = document.createElement('li');
        likesElement.dataset.likesObjectId = summaryList.objectId;
        likesElement.classList.add(LIKES_ELEMENT_CLASS);
        const likesLink = document.createElement('a');
        likesLink.href = '#';
        likesLink.classList.add('wcfLikeCounter');

        const likesIcon = document.createElement('fa-icon');
        likesIcon.size = 16;
        likesIcon.setIcon('thumbs-up');
        likesIcon.toggleAttribute('regular', true);

        const likesValue = document.createElement('span');
        likesValue.classList.add('wcfLikeValue');

        likesLink.append(likesIcon, likesValue);
        likesElement.append(likesLink);
        messageStatus.append(likesElement);

        updateLikesElement(likesElement, likesAmount);

        // click on original element when clicking the new one
        likesLink.addEventListener('click', e => {
            e.preventDefault();
            summaryList.dispatchEvent(new Event('showDetails', e));
        });
    });
GM_addStyle(`
.${LIKES_ELEMENT_CLASS}[data-likes="0"] {
    display: none;
}
`);

// ------------------------------------------------------
// remove reaction menu and use the old style of reacting
document.querySelectorAll('.reactButton').forEach(reactButton => {
    // replace the "smile" icon with the "like" icon
    reactButton.querySelector('fa-icon')?.setIcon('thumbs-up');
    reactButton.title =
        reactButton.dataset.tooltip =
        reactButton.ariaLabel =
            'Gefällt mir! (Like)';
    const textContainer = reactButton.querySelector('.invisible');
    if (textContainer) textContainer.textContent = reactButton.title;
});

(() =>
    (unsafeWindow.REACTION_TYPES = {
        [LIKE_REACTION_ID]: unsafeWindow.REACTION_TYPES[LIKE_REACTION_ID],
    }))();

// ------------------------------------------------------
// update the additional like counter
require(['WoltLabSuite/Core/Ui/Reaction/Handler'], t => {
    const ajaxSuccessOrig = t.prototype._ajaxSuccess;
    // do NOT use arrow function here, because it would break the "this" context
    t.prototype._ajaxSuccess = function (...args) {
        const result = ajaxSuccessOrig.call(this, ...args);

        const [
            {
                returnValues: {
                    objectID,
                    reactions: { [LIKE_REACTION_ID]: likesAmount },
                },
            },
        ] = args;
        const likesElement = document.querySelector(
            `.${LIKES_ELEMENT_CLASS}[data-likes-object-id="${objectID}"]`
        );
        if (likesElement) updateLikesElement(likesElement, likesAmount ?? 0);

        return result;
    };
});

// do always hide the reaction menu
GM_addStyle(`
.reactionPopover {
    display: none !important;
}

html[data-color-scheme="dark"] .${LIKES_ELEMENT_CLASS} {
    filter: brightness(2);
}
`);
