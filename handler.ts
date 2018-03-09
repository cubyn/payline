import {default as Payline} from "./src/payline";
import {CURRENCIES, Environment} from "./src/model";

// Handler for serverless framework exposing all the functions with the serverless provider

// config
const merchantId: string = process.env.MERCHANT_ID || "XXX";
const accessKey: string = process.env.ACCESS_KEY ||"XXX";
const contractId: string = process.env.MERCHANT_ID || "1234567";
const environment: Environment = (process.env.ENVIRONMENT || "") === Environment.production ?
    Environment.production : Environment.homologation;
const currency: CURRENCIES = CURRENCIES[process.env.CURRENCY || ""] || CURRENCIES.USD;

// instances
const payline = (event): Payline => {
    const instance: Payline = new Payline(event.merchantId || merchantId,
        event.accessKey || accessKey,
        event.contractId || contractId,
        event.environment || environment);
    instance.defaultCurrency = event.currency || currency;
    return instance;
};

// can encode data (ex. adding custom result code)
const result = (callback, data): void => {
    callback(null, data);
};

// functions
export const createWallet = async (event, context, callback) => {
    result(callback, await payline(event).createWallet(event.walletId, event.card));
};

export const getWallet = async (event, context, callback) => {
    result(callback, await payline(event).getWallet(event.walletId));
};

export const updateWallet = async (event, context, callback) => {
    result(callback, await payline(event).updateWallet(event.walletId, event.card, event.owner));
};

export const disableWallet = async (event, context, callback) => {
    result(callback, await payline(event).disableWallet(event.walletId));
};

export const doWebPayment = async (event, context, callback) => {
    result(callback, await payline(event).doWebPayment(event.payment, event.returnURL, event.cancelURL, event.buyer,
        event.selectedContractList, event.referencePrefix, event.currency, event.order));
};

export const doCapture = async (event, context, callback) => {
    result(callback, await payline(event).doCapture(event.transactionID, event.payment, event.currency));
};

export const doRefund = async (event, context, callback) => {
    result(callback, await payline(event).doRefund(event.transactionID, event.payment, event.comment));
};

export const scheduleWalletPayment = async (event, context, callback) => {
    result(callback, await payline(event).scheduleWalletPayment(event.walletId, event.payment, event.scheduledDate,
        event.referencePrefix, event.currency, event.order));
};

export const validateCard = async (event, context, callback) => {
    result(callback, await payline(event).validateCard(event.payment, event.card,
        event.referencePrefix, event.currency, event.order));
};

export const doReset = async (event, context, callback) => {
    result(callback, await payline(event).doReset(event.transactionID, event.comment));
};

export const doAuthorization = async (event, context, callback) => {
    result(callback, await payline(event).doAuthorization(event.payment, event.card,
        event.referencePrefix, event.currency, event.order));
};

export const doReAuthorization = async (event, context, callback) => {
    result(callback, await payline(event).doReAuthorization(event.transactionID, event.payment, event.card,
        event.referencePrefix, event.currency, event.order));
};

export const doWalletPayment = async (event, context, callback) => {
    result(callback, await payline(event).doWalletPayment(event.walletId, event.payment,
        event.referencePrefix, event.currency, event.order));
};

export const transactionDetail = async (event, context, callback) => {
    result(callback, await payline(event).transactionDetail(event.transactionID));
};

export const runAction = async (event, context, callback) => {
    result(callback, await payline(event).runAction(event.action, event.args));
};
