// IOTA SpammerXP
// https://github.com/GpanosXP/IOTA-SpammerXP
// Based upon the projust created by Peter Ryszkiewicz:
// https://github.com/pRizz/iota-transaction-spammer-webapp

var txSpammer = {
    // Providers are fetched to keep them dynamic and load balance the network.
    // If the owner of a public node does not want to be in the list, they can notify me to remove them.
    providersUrl: "https://gpanosxp.github.io/IOTA-SpammerXP/docs/providers.json",
    httpProviders: [],
    httpsProviders: [],
    validProviders: [],

    // Transaction-related data
    spamSeed: "",
    hostingSite: 'https://github.com/GpanosXP/IOTA-SpammerXP',
    tag: "99IOTA9SPAMMERXP9AAC",
    message: "",
    transfersPerBundle: 1,
    weight: 14,
    tipCount: 1000, // tips to load for selection
    manualTipSelection: false,
    allowZeroValue: true,

    // Events
    eventEmitter: new EventEmitter(),

    // Workers
    workers: [],
    workerJobs: [],
    workerPool: new Pool(),
    workingCounter: 0,
    workerRemovePromise: undefined,
    workerRemoveAllPromise: undefined,

    // Enums and misc
    stateTypes: {
        None:        0,
        Info:        1,
        Start:       2,
        Stop:        3,
        Local:       4,
        Net:         5
    }
};

/// General/Helper Functions

    // WARNING: Not a perfect tritifier for URL's - only handles a few special characters
    txSpammer.tritifyURL = function(url)
    {
        return url.replace(/:/gi, 'COLON').replace(/\./gi, 'DOT').replace(/\//gi, 'SLASH').replace(/-/gi, 'DASH').toUpperCase();
    };

    // Returns a depth in [4, 12] inclusive
    txSpammer.generateDepth = function()
    {
        return Math.floor(Math.random() * (12 - 4 + 1)) + 4;
    }

    // Returns a valid somewhat-random seed (not secure for non-zero value use !)
    txSpammer.generateSeed = function()
    {
        const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ9';
        return Array.from(new Array(81), (x, i) => validChars[Math.floor(Math.random() * validChars.length)]).join('');
    }

    txSpammer.generateTransfers = function()
    {
        return Array.from(new Array(txSpammer.transfersPerBundle), (x, i) => {
            return {
                address: txSpammer.spamSeed,
                tag: txSpammer.tag,
                message: txSpammer.message,
                value: 0
            }
        });
    };

/// Events

    txSpammer.emitState = function(id, message)
    {
        this.eventEmitter.emitEvent('state', ["Worker " + id + ": " + message]);
    }
    txSpammer.emitError = function(id, message)
    {
        this.eventEmitter.emitEvent('state', ["Error by worker " + id + ": " + message]);

        if (this.workers[id].running) this.replaceWorker(id).then((newWorker) => newWorker.startSpamming());
    }
    txSpammer.emitWorking = function(id, isWorking)
    {
        if (isWorking) this.workingCounter++;
        else this.workingCounter--;
        if (this.workingCounter < 0) this.workingCounter = 0;

        this.eventEmitter.emitEvent('working', [this.workingCounter]);
    }

/// Providers

    txSpammer.getRandomProvider = function()
    {
        // TODO: rank providers by average response time
        return this.validProviders[Math.floor(Math.random() * this.validProviders.length)];
    }

    txSpammer.getValidProviders = function()
    {
        // Web browser polices enforce the use of https when the website is accessed by https too.
        if (window.location.protocol == "https") return this.httpsProviders;
        else return this.httpProviders.concat(this.httpsProviders);
    }

    txSpammer.fetchProviders = function(callback)
    {
        return $.ajax({ url: this.providersUrl }).done((reply) => {
            if (!reply) return;
            if (reply.http) this.httpProviders = reply.http;
            if (reply.https) this.httpsProviders = reply.https;

            this.validProviders = this.getValidProviders();
            if (callback) this.callback();
        });
    }

/// Workers

    txSpammer.getRunningCount = function()
    {
        var counter = 0;
        for (var i = this.workers.length - 1; i >= 0; i--) if (this.workers[i].running) counter++;
        return counter;
    }

    txSpammer.addWorker = function(provider)
    {
        const id = this.workers.length;
        this.workers.push(undefined);
        this.workerJobs.push(undefined);
        return this.createWorker(id, provider);
    }

    txSpammer.removeWorker = function()
    {
        if (this.workerRemovePromise) return this.workerRemovePromise;

        const id = this.workers.length - 1;
        if (id < 0) return Promise.reject();

        this.workerRemovePromise = this.workers[id].stopSpamming().then((claimedID) => {
            this.workers.pop();
            this.workerJobs.pop();
            this.workerRemovePromise = undefined;
        });

        return this.workerRemovePromise;
    }

    txSpammer.createWorker = function(id, provider)
    {
        if (!(id < this.workers.length) || this.workers[id]) return false;

        const forcedProvider = !!provider;
        if (!forcedProvider) provider = this.getRandomProvider();

        const newWorker = new this.worker(id, provider, forcedProvider);
        this.workers[id] = newWorker;
        return newWorker;
    }

    txSpammer.replaceWorker = function(id)
    {
        if (!(id < this.workers.length)) return Promise.reject();

        return new Promise((resolve, reject) => {
            if (this.workers[id]) {
                this.workers[id].stopSpamming().then((claimedID) => {

                    const provider = this.workers[id].forcedProvider ? this.workers[id].provider : undefined;

                    this.workers[id] = undefined; // delete old worker
                    resolve(this.createWorker(id, provider));
                });
            }
            else resolve(this.createWorker(id));
        });
    }

    txSpammer.startAll = function()
    {
        for (var i = 0; i < this.workers.length; i++) this.workers[i].startSpamming();
    }
    // Tells all workers to stop and returns a promise
    // that is resolved when all workers have stopped.
    txSpammer.stopAll = function()
    {
        const count = this.workers.length;

        const promises = new Array(count);
        for (var i = 0; i < count; i++) promises[i] = this.workers[i].stopSpamming();

        return Promise.all(promises);
    }

    txSpammer._removeAll = function(resolve)
    {
        if (!this.workers.length) {
            this.workerRemoveAllPromise = undefined;
            return resolve();
        }

        this.removeWorker().then(() => {
            txSpammer._removeAll(resolve);
        });
    }
    txSpammer.removeAll = function()
    {
        if (!this.workerRemoveAllPromise) {
            this.workerRemoveAllPromise = new Promise((resolve, reject) => {
                this.stopAll().then(() => this._removeAll(resolve));
            });
        }

        return this.workerRemoveAllPromise;
    }

    txSpammer.setPoolSize = function(newSize)
    {
        const dif = newSize - this.workerPool.count;
        return dif >= 0 ? this.workerPool.addSlots(dif) : this.workerPool.removeSlots(-dif);
    }

    txSpammer.requestJob = function(workerID)
    {
        this.workerPool.occupy().then((job) => {
            this.workerJobs[workerID] = job;
            this.workers[workerID].doJob();
        });
    }

    txSpammer.releaseJob = function(workerID)
    {
        this.workerPool.free(this.workerJobs[workerID]);
    }

/// Worker class
txSpammer.worker = function(myID, myProvider, forcedProvider)
{
    this.ID = myID;
    this.provider = myProvider;
    this.forcedProvider = forcedProvider;

    this.running = false;

    var stopPromise, stopPromiseResolve;

    this.emitState = function(type, message)
    {
        // Do something with Date.now()
        txSpammer.emitState(myID, message);
    };
    this.emitError = function(message)
    {
        txSpammer.emitError(myID, message);

        this.running = false;
        this.stopped();

        return false; // Return a "negative" signal
    };
    this.emitWorking = function(message)
    {
        txSpammer.emitWorking(myID, message);
    };

    this.startSpamming = function()
    {
        if (this.running) return;
        this.running = true;
        this.emitState(txSpammer.stateTypes.Start, "Started transaction spamming.");

        this.initializeIOTA() &&
        this.syncAndSend();
    };
    this.stopSpamming = function()
    {
        if (stopPromise) return stopPromise;

        if (!this.running) return Promise.resolve(myID);
        this.running = false;

        stopPromise = new Promise((resolve) => stopPromiseResolve = resolve);
        return stopPromise;
    };
    this.restartSpamming = function()
    {
        this.stopSpamming().then(() => this.startSpamming());
    };
    this.finished = function()
    {
        if (this.running) this.prepareTx();
        else {
            this.emitState(txSpammer.stateTypes.Stop, "Stopped transaction spamming.");
            this.stopped();
        }
    };
    this.stopped = function()
    {
        if (!stopPromise) return;

        stopPromise = undefined;
        stopPromiseResolve(myID);
    };

    // Iota-related

    var iota;
    var tipHashes = [];
    var tips = [];
    var usefulTips = [];
    var otherTips = [];
    var _toApprove = {};
    var _trytes = "";

    this.initializeIOTA = function()
    {
        this.emitState(txSpammer.stateTypes.Info, "Initializing IOTA library.");

        iota = new IOTA({'provider': myProvider});
        //curl.overrideAttachToTangle(iota.api); // Not working after last iota update
        // The new PoW function (same as in the wallet) is implemented in "iota.extensions.js"

        return iota;
    };

    this.syncAndSend = function()
    {
        if (!this.running) return this.finished();
        this.emitState(txSpammer.stateTypes.Net, "Checking if node is synced: " + myProvider);

        const prom = iota.getNodeInfoAsync();
        prom.catch((error) => this.emitError("Error while checking if node is synced.", error));
        prom.then((nodeInfo) => {
            const synced = !(
                nodeInfo.latestMilestone == txSpammer.spamSeed ||
                nodeInfo.latestSolidSubtangleMilestone == txSpammer.spamSeed ||
                nodeInfo.latestSolidSubtangleMilestoneIndex < nodeInfo.latestMilestoneIndex
            );
            if (!synced) return this.emitError("Node is not synced.");

            if (txSpammer.manualTipSelection) this.fetchTips();
            else this.prepareTx();
        });
    };

    this.fetchTips = function()
    {
        if (!this.running) return this.finished();
        this.emitState(txSpammer.stateTypes.Net, "Fetching tip hashes");

        const prom = iota.getTipsAsync();
        prom.catch((error) => this.emitError("Error while fetching tip hashes.", error));
        prom.then((tips) => {
            const count = tips.length;
            const range = Math.max(count - txSpammer.tipCount, 0);
            const pos = Math.floor(range * Math.random());

            tipHashes = tips.slice(pos, pos + txSpammer.tipCount);
            this.fetchTipObjects();
        });
    };

    this.fetchTipObjects = function()
    {
        if (!this.running) return this.finished();
        this.emitState(txSpammer.stateTypes.Net, "Fetching tip objects");

        const prom = iota.getTransactionsObjectsAsync(tipHashes);
        prom.catch((error) => this.emitError("Error while fetching tip objects.", error));
        prom.then((txObjects) => {
            tips = txObjects;
            this.processTips();
        });
    };

    this.processTips = function()
    {
        if (!this.running) return this.finished();
        this.emitState(txSpammer.stateTypes.Local, "Processing tips");

        const log2 = document.getElementById("log2");
        usefulTips = [];
        otherTips = [];
        for (var i = tips.length - 1; i >= 0; i--) {
            if (tips[i].value || txSpammer.allowZeroValue && Math.random() < 0.5) {
                usefulTips.push(tips[i]);
                log2.textContent += "\nValue: " + tips[i].value + ", tag: " + tips[i].tag + ", address: " + tips[i].address;
            }
            else otherTips.push(tips[i]);
        }

        const tot = tips.length;
        const use = usefulTips.length;
        var message = "Tips processed, results: " + tot + " total, " + use + " useful, " + Math.round(1000 * use / tot) / 10 + "%";
        if (!txSpammer.allowZeroValue) this.emitState(txSpammer.stateTypes.Info, message);

        this.prepareTx();
    };

    this.prepareTx = function()
    {
        if (!this.running) return this.finished();
        this.emitState(txSpammer.stateTypes.Local, "Preparing transactions");

        const prom = iota.prepareTransfersAsync(txSpammer.spamSeed, txSpammer.generateTransfers(), {});
        prom.catch((error) => this.emitError("Error while preparing transactions.", error));
        prom.then((trytes) => {
            _trytes = trytes;
            if (txSpammer.manualTipSelection) this.pickTxs();
            else this.requestTxs();
        });
    };

    this.requestTxs = function()
    {
        if (!this.running) return this.finished();
        this.emitState(txSpammer.stateTypes.Net, "Requesting transactions to create confirmations for.");

        const prom = iota.getTransactionsToApproveAsync(txSpammer.generateDepth());
        prom.catch((error) => this.emitError("Error while getting transactions to approve.", error));
        prom.then((toApprove) => this.ensureUsefulTx(toApprove));
    };

    this.ensureUsefulTx = function(toApprove)
    {
        if (!this.running) return this.finished();
        if (txSpammer.allowZeroValue) return this.awaitToAttach(toApprove);
        this.emitState(txSpammer.stateTypes.Net, "Ensuring transactions are useful.");

        const prom = iota.getTransactionsObjectsAsync([toApprove.trunkTransaction, toApprove.branchTransaction]);
        prom.catch((error) => this.attachTx(toApprove));
        prom.then((txObjects) => {
            document.getElementById("log2").textContent += "\nTx values: " + txObjects[0].value + ", " + txObjects[1].value
                                                        + ", tags: " + txObjects[0].tag + ", " + txObjects[1].tag;
            if (txObjects[0].value || txObjects[1].value) this.awaitToAttach(toApprove);
            else this.requestTxs();
        });
    };

    this.pickTxs = function()
    {
        if (!usefulTips.length || !otherTips.length) return this.emitError("No more useful tips to confirm!");

        this.awaitToAttach({trunkTransaction: usefulTips.pop().hash, branchTransaction: otherTips.pop().hash});
    };

    this.awaitToAttach = function(toApprove)
    {
        _toApprove = toApprove;
        txSpammer.requestJob(myID);
        this.emitState(txSpammer.stateTypes.Local, "Waiting for job vacancy in worker pool.");
    };

    this.doJob = function()
    {
        if (!this.running) {
            this.jobDone();
            this.finished();
            return;
        }

        this.emitWorking(true);
        this.attachTx();
    };

    this.attachTx = function()
    {
        this.emitState(txSpammer.stateTypes.Local, "Performing PoW (Proof of Work)");

        const prom = iota.attachToTangleAsync(_toApprove.trunkTransaction, _toApprove.branchTransaction, txSpammer.weight, _trytes);
        prom.catch((error) => this.emitError("Error while attaching transactions.", error));
        prom.then((attached) => {
            this.jobDone();
            this.broadcastTx(attached);
        });
    };

    this.jobDone = function()
    {
        this.emitWorking(false);
        txSpammer.releaseJob(myID);
    };

    this.broadcastTx = function(attached)
    {
        this.emitState(txSpammer.stateTypes.Net, "Completed PoW (Proof of Work), broadcasting confirmations.");

        const prom = iota.storeAndBroadcastAsync(attached);
        prom.catch((error) => this.emitError("Error while broadcasting transactions.", error));
        prom.then((report) => this.logAndFinish(attached));
    };

    this.logAndFinish = function(attached)
    {
        this.emitState(txSpammer.stateTypes.Info, "Broadcast completed.");

        var finalTxs = [];
        attached.forEach((trytes) => finalTxs.push(iota.utils.transactionObject(trytes)));

        txSpammer.eventEmitter.emitEvent('transactionCompleted', [finalTxs]);
        this.finished();
    };

};

/// Initialization

    txSpammer.Init = function()
    {
        this.spamSeed = this.generateSeed();
        this.message = this.tritifyURL(this.hostingSite);

        this.setPoolSize(1);

        return this.fetchProviders();
    };
