chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.text === "getCrfTokenRequest") {
        sendResponse(document.getElementsByName("csrf-token")[0].content);
        return;
    }
    if (msg.text === "inputBet") {
        inputBet();
        return;
    }
    if (msg.text === "placeBet") {
        const $cancel = document.getElementsByClassName("swal2-cancel");
        if ($cancel.length > 0) {
            $cancel[0].click()
        }
        const betSide = msg.betSide === 'meron' ? 0 : 1;
        const $postBet = document.getElementsByClassName("post-bet");
        if ($postBet.length > 0) {
            $postBet[betSide].click();
        }
    }
    if (msg.text === "submitBet") {
        const $confirm = document.getElementsByClassName("swal2-confirm");
        if ($confirm.length > 0) {
            $confirm[0].click();
        }
    }
    if (msg.text === "remainingPoints") {
        sendResponse(parseInt(document.getElementsByClassName("currentPointsDisplay")[0].children[0].innerHTML.replace(',', '')) - 100);
    }
    if (msg.text === "submittedBetValue") {
        const betSide = msg.betSide === 'meron' ? 0 : 1;
        try {
            sendResponse(parseInt(document.getElementsByClassName("my-bets")[betSide].innerText.replace(',', '')));
        } catch (e) {
        }
    }

    function inputBet() {
        document.getElementsByClassName("betAmount")[0].focus();
        document.execCommand('delete', false);
        document.execCommand('delete', false);
        document.execCommand('delete', false);
        document.execCommand('delete', false);
        document.execCommand('delete', false);
        document.execCommand('delete', false);
        document.execCommand('insertText', false, msg.betAmountPlaced);
    }
});