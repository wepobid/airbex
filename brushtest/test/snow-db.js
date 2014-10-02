/*global require*/
var debug = require('debug')('SnowDb');
var pg = require('pg');
var request = require('supertest');
var async = require('async');
var crypto = require('crypto');
var Q = require("q");

module.exports = function (config) {
    var snowDb = {};
    snowDb.config = config;
    snowDb.pgClient = new pg.Client(config.pg_write_url);
    
    snowDb.getUserCount = function (done){
        debug("getUserCount");
        this.pgClient.query({
            text: 'SELECT COUNT(*) FROM "user"',
            values: []
        }, function(err, dres) {
            if (err) {
                done(null, err);
            } else if(!dres.rows.length){
                done(null, "getUserCount empty length");
            } else {
                var row = dres.rows[0];
                var count = row.count;
                debug("getUserCount: %s", count);
                done(count);
            }
        });
    };
    snowDb.getUserIdFromEmail = function (email){
        var deferred = Q.defer();
        debug("getUserIdFromEmail email: %s", email);
        this.pgClient.query({
            text: 'SELECT user_id FROM "user" where email=$1',
            values: [email]
        }, function(err, dres) {
            if (err) {
                deferred.reject(err);
            } else if(!dres.rows.length){
                deferred.reject({name:"NoSuchUser"})
            } else {
                var row = dres.rows[0];
                var user_id = row.user_id;
                debug("getUserIdFromEmail: %s", user_id);
                deferred.resolve(user_id);
            }
        });
        
        return deferred.promise;
    };   
   
    snowDb.restoreResetPassword = function (email){
        var deferred = Q.defer();
        console.log("getResetPasswordCode email: %s", email);
        this.pgClient.query({
            text: 'UPDATE "user" set reset_email_code=NULL, reset_started_at=NULL, reset_phone_code=NULL where email=$1',
            values: [email]
        }, function(err, dres) {
            if (err) {
                console.log(err)
                deferred.reject(err);
            } else {
                //var row = dres.rows[0];
                //var reset_email_code = row.reset_email_code;
                //debug("getResetPasswordCode: %s", reset_email_code);
                deferred.resolve();
            }
        });
        
        return deferred.promise;
    };
    
    snowDb.getResetPasswordCode = function (email){
        var deferred = Q.defer();
        debug("getResetPasswordCode email: %s", email);
        this.pgClient.query({
            text: 'SELECT reset_email_code FROM "user" where email=$1',
            values: [email]
        }, function(err, dres) {
            if (err) {
                deferred.reject(err);
            } else if(!dres.rows.length){
                deferred.reject({name:"NoSuchUser"})
            } else {
                var row = dres.rows[0];
                var reset_email_code = row.reset_email_code;
                debug("getResetPasswordCode: %s", reset_email_code);
                deferred.resolve(reset_email_code);
            }
        });
        
        return deferred.promise;
    };
    
    snowDb.queryUserEmailCode = function(email, done) {
        debug("queryUserEmailCode email:%s", email);
        this.pgClient.query({
            text: 'SELECT code from user_pending where email=$1',
            values: [email]
        }, function(err, dres) {
            if (err) {
                done(null, err);
            } else if(!dres.rows.length){
                done(null, "no email code found for email");
            } else {
                var row = dres.rows[0];
                var code = row.code;
                debug("email %s, code %s", email, code);
                done(code);
            }
        });
    };
    
    snowDb.queryUserPhoneCode = function(email, done) {
        debug("queryUserPhoneCode email:%s", email);
        this.pgClient.query({
            text: 'select phone_number_verify_code from "user" where email=$1',
            values: [email]
        }, function(err, dres) {
            if (err) {
                done(err);
            } else if(!dres.rows.length){
                done("no phone code found for email");
            } else {
                var row = dres.rows[0];
                var code = row.phone_number_verify_code;
                debug("email %s, phone code %s", email, code);
                done(null, code);
            }
        });
    };
    snowDb.deletePhoneNumber = function(email, done) {
        debug("deletePhoneNumber email:%s", email);
        this.pgClient.query({
            text: 'update "user" set phone_number=NULL,phone_number_verify_attempts=NULL where email=$1',
            values: [email]
        }, function(err) {
            done(err)
        });
    };
    snowDb.getPhoneNumber = function(email, done) {
        debug("getPhoneNumber email:%s", email);
        this.pgClient.query({
            text: 'select phone_number from "user" where email=$1',
            values: [email]
        }, function(err, dres) {
            if (err) {
                done(err);
            } else if(!dres.rows.length){
                done("no phone number found for email");
            } else {
                var row = dres.rows[0];
                var phone_number = row.phone_number;
                debug("email %s, phone code %s", email, phone_number);
                done(null, phone_number);
            }
        });
    };
    
    snowDb.userSetInfo = function(user, done) {
        debug("userSetInfo email:%s", user.email);
        if(user.admin){
            this.pgClient.query({
                text: 'UPDATE "user" SET admin=true where email=$1',
                values: [user.email]
            }, function(err, dres) {
                if(err) { 
                    done(err);
                } else {
                    done();
                }
            });
        } else {
            done();
        }
    };
 
    snowDb.getAccountId = function (user_id, currency, done){
        debug("getAccountId user_id: %s", user_id);
        this.pgClient.query({
            text: 'SELECT account_id FROM account WHERE user_id = $1 AND currency_id = $2',
            values: [user_id, currency]
        }, function(err, dres) {
            if (err) {
                done(err);
            } else if(!dres.rows.length){
                done("no account found");
            } else {
                var row = dres.rows[0];
                var account_id = row.account_id;
                debug("user_id %s, account_id %s", user_id, account_id);
                done(null, account_id);
            }
        });
    };
    
    snowDb.depositAddress = function (account_id, address, done){
        debug("depositCrypto account_id: %s, address: %s", account_id, address);
        this.pgClient.query({
            text: [
                'INSERT INTO btc_deposit_address (account_id, address)',
                'VALUES ($1, $2)'
            ].join('\n'),
            values: [account_id, address]
        }, function(err) {
            //if (err) return done(err)
            done()
        })
    };
    
    snowDb.creditCrypto = function (user, currency, deposit_address, amount){
        var deferred = Q.defer();
        var hash = crypto.createHash('sha256')
        hash.update(crypto.randomBytes(8))
        var txid = hash.digest('hex')
        
        debug("creditCrypto amount: %s, address: %s, txid: %s", amount, deposit_address, txid);
        this.pgClient.query({
            text: [
                'SELECT crypto_credit($1, $2, $3, $4);'
            ].join('\n'),
            values: [currency, txid, deposit_address, amount]
        }, function(err) {
            if (err) return deferred.reject(err)
            deferred.resolve();
        })
        return deferred.promise;
    };
    
    snowDb.setDepositAddress = function(user, currency, done) {
        var email = user.email;
        debug("setDepositAddress email:%s", email);
        async.waterfall(
                [
                 function(callback) {
                     snowDb.getUserIdFromEmail(email).then(function(user_id) {
                         callback(null, user_id);
                     }).fail(callback);
                 },
                 function(user_id, callback) {
                     snowDb.getAccountId(user_id, currency, function(err, account_id) {
                         callback(err, account_id);
                     });
                 },
                 function(account_id, callback) {
                     snowDb.depositAddress(account_id, user.btc_deposit_address, function(err) {
                         callback(err);
                     });
                 }
                 ],

                 function(err) {
                    debug("setDepositAddress done")
                    done(err);
                }
        );
   
    };    
    return snowDb;
};