let websocket;
let tab = { id : 0 };
const wssUrl = 'wss://echo.wpc2022.live/socket.io/?EIO=3&transport=websocket';

const betLevel = [
    281,
    281,
    612,
    1292
];

const meron = 'meron';
const wala = 'wala';

const maxGame = 8;

let presentLevel = 0;
let previousDiff = 0;
let isBetSubmitted = false;
let hasPicked = false;
let finalBetside = wala;

let winStreak = 0;
let lossStreak = 0;
let succeedingLossStreak = 0;
let gameProgressCount = 0;
let gameSkippedCount = 0;
let isPauseGameNextRound = false;
let isGamePaused = false;

function createWebSocketConnection(crfToken) {
    if('WebSocket' in window){
        websocketConnect(crfToken);
    }
}

const tabsOnUpdated = {
    setTabId : function(tabId){
        chrome.storage.sync.set({'tabId' : tabId },
            function() {
                tab.id = tabId;
            });
    }
}
const websocketConnect = (crfToken) => {
    if (websocket === undefined) {
        console.log('Websocket initialized!')
        websocket = new WebSocket(wssUrl);
    }
    websocket.onopen = function () {
        const subscriptionBody = [
            'subscribe',
            {
                channel: 'betting',
                auth: {
                    endpoint: '/broadcasting/auth',
                    headers: {
                        'X-CSRF-TOKEN': crfToken
                    }
                }
            }
        ];
        websocket.send(`42${JSON.stringify(subscriptionBody)}`);
    };

    websocket.onmessage = async function (event) {
        if (event.data === '3') {
            return;
        }
        if (event.data === '40') {
            console.log('Websocket connected successfully!')
            return;
        }
        if (event.data.substr(0, 2) === '0{') {
            return;
        }
        const data = JSON.parse(event.data.substr(2, event.data.length - 1));

        if (data.length === 0) {
            return;
        }

        const fightEvent = data[0];
        const isBetting = data[1] === 'betting';

        if (presentLevel > betLevel.length - 1) {
            console.log('Insufficient funds!');
            return;
        }

        if (fightEvent === 'App\\Events\\FightUpdate') {
            const fightData = data[2].data;
            const fightStatus = fightData.status;
            const winner = fightData.winner;
            const isOpenBet = fightData.open_bet === 'yes';
            const isNewFight = fightData.newFight === 'yes';

            hasPicked = false;

            if (fightStatus === 'cancelled' && isOpenBet === false) {
                paymentSafe();
                setFinalBet();

                isBetSubmitted = false;
                isPauseGameNextRound = false;
                return;
            }
            if (fightStatus === 'finished' && isOpenBet === false && isBetting === true) {
                previousDiff = 0;

                gameProgressCount = gameProgressCount + 1;

                if(isGamePaused === true) {
                    gameSkippedCount = gameSkippedCount + 1;
                }

                const isWinner = winner === finalBetside;
                const isDraw = winner === 'draw';

                if (isBetSubmitted === true) {
                    if (isDraw) {
                        paymentSafe(isDraw);
                        setFinalBet();

                        isBetSubmitted = false;
                        isPauseGameNextRound = false;
                        return;
                    } else {
                        if (isWinner) {
                            console.log('%cCongratulations!', 'font-weight: bold; color: green', `${winner} wins`);
                            isPauseGameNextRound = true;
                        } else {
                            console.log('%cYou lose!', 'font-weight: bold; color: red', 'Your bet is', `${finalBetside} but ${winner} wins`);
                        }
                    }
                }

                if ((finalBetside === '' || isBetSubmitted === false)) {
                    if (isGamePaused === false) {
                        console.log(`No bets detected! ${winner} wins`);
                    }
                    isBetSubmitted = false;
                    return;
                }
                if (isBetSubmitted === true) {
                    if (isWinner) {
                        presentLevel = 0;

                        winStreak = winStreak + 1;
                        lossStreak = 0;
                        succeedingLossStreak = 0;
                    } else {
                        presentLevel = presentLevel + 1;

                        lossStreak = lossStreak + 1;
                        succeedingLossStreak = succeedingLossStreak + 1;
                        winStreak = 0;
                    }
                }

                isBetSubmitted = false;
                printRemainingLives();

                return;
            }
            if (fightStatus === 'on-going' && isOpenBet === false && isNewFight === false) {
                return;
            }
        }
        if (fightEvent === 'App\\Events\\BettingPosted' && isBetting === true) {
            // Rest for 2 games
            if(gameSkippedCount > 1 && isPauseGameNextRound === true && isGamePaused === true){
                gameSkippedCount = 0;
                gameProgressCount = 0;
                isPauseGameNextRound = false;
                isGamePaused = false;
                isBetSubmitted = false;

                // restartStreaks()

                console.log(`%c-= Game recommencing =-`, 'font-weight: bold; color: orange');
            }
            if(gameProgressCount >= maxGame && isPauseGameNextRound === true && winStreak > 1) {
                console.log(`%c-= Game skipped: ${gameSkippedCount + 1} of 2 =-`, 'font-weight: bold; color: orange');
                isGamePaused = true;
                return;
            }

            isPauseGameNextRound = false;

            await new Promise(resolve => setTimeout(resolve, 22000));

            if (isBetSubmitted === true) {
                return;
            }

            chrome.tabs.sendMessage(tab.id, {text: "inputBet", bet: betLevel[presentLevel]});

            setFinalBet();

            // Do not reverse if streaking
            // Do not reverse if losing streak is more than 3 times
            if (winStreak > 1) {
                setFinalBet();
                restartStreaks();
            }

            await new Promise(resolve => setTimeout(resolve, 500));
            chrome.tabs.sendMessage(tab.id, {text: "placeBet", betSide: finalBetside});

            if (isBetSubmitted === true) {
                return;
            }

            chrome.tabs.sendMessage(tab.id, {text: "submitBet"});

            console.log('--------------------');
            console.log(`Betting for -%c${finalBetside}-`, 'font-weight: bold; color: pink');

            hasPicked = true;
            isBetSubmitted = true;
        }
    }
    websocket.onclose = function () {
        websocket = undefined;
        console.log('Connection Closed!!!!');
    };
    setInterval(function () {
        try {
            websocket.send('2');
        } catch (e) {
        }
    }, 15000);
}

function restartStreaks() {
    winStreak = 0;
    lossStreak = 0;
    succeedingLossStreak = 0;
}
function setFinalBet() {
    if (finalBetside === meron) {
        finalBetside = wala;
    } else if (finalBetside === wala) {
        finalBetside = meron;
    }
}
function paymentSafe(isDraw) {
    console.log('%cPayment is safe!', 'font-weight: bold; color: yellow', isDraw ? 'It\'s a draw' : 'Game cancelled');
    printRemainingLives();
}
function printRemainingLives() {
    console.log(`${betLevel.length - presentLevel} of ${betLevel.length} lives remaining. Bets will be now at ${betLevel[presentLevel]} pesos.`);
}

chrome.tabs.onUpdated.addListener(function(tabId, info) {
    if (info.status === "complete") {
        tabsOnUpdated.setTabId(tabId);
    }
});
chrome.extension.onConnect.addListener(function(port) {
    port.onMessage.addListener(function (message) {
        if (port.name === 'getCrfToken') {
            chrome.tabs.sendMessage(tab.id, {text: "getCrfTokenRequest"},
                function (crfToken) {
                    createWebSocketConnection(crfToken);
                }
            );
        }
    });
});