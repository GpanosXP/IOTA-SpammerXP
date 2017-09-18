/**
 * Based upon the projust created by Peter Ryszkiewicz (https://github.com/pRizz) on 9/10/2017:
 * https://github.com/pRizz/iota-transaction-spammer-webapp
 */

/// Helper functons

    function getid(id) { return document.getElementById(id); }

    function msToHHMMSS(ms)
    {
        var seconds = Math.floor(ms / 1000);
        var minutes = Math.floor(seconds / 60);
        var hours   = Math.floor(minutes / 60);

        // Change from total to remainders
        seconds -= minutes * 60;
        minutes -= hours * 60;

        hours = hours + "";
        minutes = minutes < 10 ? "0" + minutes : "" + minutes;
        seconds = seconds < 10 ? "0" + seconds : "" + seconds;

        return hours + ":" + minutes + ":" + seconds;
    }

/// Constants

    const iotasearchBaseURL = 'https://iotasear.ch/hash/'
    const iotatipsBaseURL = 'http://www.iota.tips/search/?kind=transaction&hash='
    const hostingSite = 'https://github.com/GpanosXP/iota-transaction-spammer-webapp';
    const hostingSiteTritified = txSpammer.tritifyURL(hostingSite);
    txSpammer.message = hostingSiteTritified;

    const startMilliseconds = Date.now();

// GUI stuff

    txCounter = 0;
    function updateGUI()
    {
        const totalTime = Date.now() - startMilliseconds;
        getid("timeSpentSpamming").innerText = msToHHMMSS(totalTime);
        getid("averageConfirmationDuration").innerText = "?"; // TODO
        getid("confirmationCount").innerText = txCounter * 2;
        getid("cpmCount").innerText = (txCounter * 120000 / totalTime).toFixed(3);
    }

/// txSpammer events

    var logElem;
    function log(message)
    {
        var logline = document.createElement("div");
        logline.innerHTML = message;
        logElem.appendChild(logline);
    }

    txSpammer.eventEmitter.on('state', function(state) {
        console.log(state);
        log("<div>" + state + "</div>");
    });

    txSpammer.eventEmitter.on('transactionCompleted', function(success) {
        txCounter++;
        success.forEach((element) => {
            log("<div>New transaction created: <a href=\"" + iotasearchBaseURL + element.hash + "\">iotasear.ch</a> <a href=\"" + iotatipsBaseURL + element.hash + "\">iota.tips</a></div>");
        });
    });

    txSpammer.eventEmitter.on('working', function(count) {
        getid("workingCount").textContent = count;
        if (count) {
            // Stop gpu intensive tasks
            var elems = document.getElementsByClassName('progress-bar-animated')
            for (var i = 0; i < elems.length; i++) elems[i].classList.remove('active')
        }
        else {
            // Restore gpu intensive tasks
            var elems = document.getElementsByClassName('progress-bar-animated')
            for (var i = 0; i < elems.length; i++) elems[i].classList.add('active')
        }
    });

/// Window close halnder

    var closing = false;
    function forceClose() { closing = true; window.close(); }
    function dontClose() { closing = false; }
    window.onbeforeunload = function(e) {
        if (closing) return;
        closing = true;

        // TODO: add proper message in the webpage (modal ?)
        // like "will close automatically, waiting for N workers to finish"
        // with force close and cancel close buttons

        txSpammer.stopAll().then(() => { if (closing) window.close(); });

        var dialogText = "Force stop all workers ?";
        e.returnValue = dialogText;
        return dialogText;
    };

/// Initialization
document.addEventListener("DOMContentLoaded", function()
{

    logElem = getid("eventLogContent");
    getid("workerCount").textContent = 1;

    setInterval(updateGUI, 1000);

    txSpammer.Init().then(() => txSpammer.addWorker().startSpamming());

});
