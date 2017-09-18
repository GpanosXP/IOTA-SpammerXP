/**
 * Created by Peter Ryszkiewicz (https://github.com/pRizz) on 9/10/2017.
 * https://github.com/pRizz/iota-transaction-spammer-webapp
 */

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

const hostingSite = 'https://github.com/GpanosXP/iota-transaction-spammer-webapp';
const hostingSiteTritified = txSpammer.tritifyURL(hostingSite);

txSpammer.message = hostingSiteTritified;

txSpammer.eventEmitter.on('state', function(state) {
    console.log(state);
    $('#eventLogContent').prepend(`<div>${state}</div>`);
})

txSpammer.eventEmitter.on('transactionCompleted', function(success) {
    const iotasearchBaseURL = 'https://iotasear.ch/hash/'
    const iotaTipsBaseURL = 'http://www.iota.tips/search/?kind=transaction&hash='
    success.forEach((element) => {
        const iotaSearchURL = `${iotasearchBaseURL}${element.hash}`
        $('#eventLogContent').prepend(`<div>New transaction created: <a href="${iotaSearchURL}">${iotaSearchURL}</a> </div>`)

        const iotaTipsURL = `${iotaTipsBaseURL}${element.hash}`
        $('#eventLogContent').prepend(`<div>New transaction created: <a href="${iotaTipsURL}">${iotaTipsURL}</a> </div>`)

    })
})

txSpammer.eventEmitter.on('working', function(count) {
    if (count) {
        // Stop gpu intensive tasks
        var elems = document.getElementsByClassName('spinnable')
        for (var i = 0; i < elems.length; i++) elems[i].classList.remove('spinning')
        var elems = document.getElementsByClassName('progress-bar-animated')
        for (var i = 0; i < elems.length; i++) elems[i].classList.remove('active')
    }
    else {
        // Restore gpu intensive tasks
        var elems = document.getElementsByClassName('spinnable')
        for (var i = 0; i < elems.length; i++) elems[i].classList.add('spinning')
        var elems = document.getElementsByClassName('progress-bar-animated')
        for (var i = 0; i < elems.length; i++) elems[i].classList.add('active')
    }
    document.getElementById("workingCount").textContent = count;
});

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

document.addEventListener("DOMContentLoaded", function() {
    const startMilliseconds = Date.now();

    function updateTimer() {
        $('#timeSpentSpamming')[0].innerText = msToHHMMSS(Date.now() - startMilliseconds);
    }
    setInterval(updateTimer, 1000);

    txSpammer.Init().then(() => txSpammer.addWorker().startSpamming());
    document.getElementById("workerCount").textContent = 1;
});
