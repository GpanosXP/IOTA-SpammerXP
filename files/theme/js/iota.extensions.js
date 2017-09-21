// Iota api extensions

/// Promisified version of IOTA api functions

    IOTA.prototype.prepareTransfersAsync = function(seed, transfers, options)
    {
        return new Promise((resolve, reject) =>
            this.api.prepareTransfers(seed, transfers, options, (error, trytes) => error ? reject(error) : resolve(trytes))
        );
    };

    IOTA.prototype.getTransactionsToApproveAsync = function(depth)
    {
        return new Promise((resolve, reject) =>
            this.api.getTransactionsToApprove(depth, (error, toApprove) => error ? reject(error) : resolve(toApprove))
        );
    };

    IOTA.prototype.getTransactionsObjectsAsync = function(hashes)
    {
        return new Promise((resolve, reject) =>
            this.api.getTransactionsObjects(hashes, (error, txObjects) => error ? reject(error) : resolve(txObjects))
        );
    };

    IOTA.prototype.attachToTangleAsync = function(trunkTransaction, branchTransaction, minWeightMagnitude, trytes)
    {
        return new Promise((resolve, reject) =>
            this.api.attachToTangle(trunkTransaction, branchTransaction, minWeightMagnitude, trytes, (error, attached) => error ? reject(error) : resolve(attached))
        );
    };

    IOTA.prototype.storeAndBroadcastAsync = function(trytes)
    {
        return new Promise((resolve, reject) =>
            this.api.storeAndBroadcast(trytes, (error, finalTxs) => error ? reject(error) : resolve(finalTxs))
        );
    };
