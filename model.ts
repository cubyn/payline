import * as path from "path";


export const enum Environment { homologation = "homologation", production = "production" }
export const enum Operation { webPayment = "webPayment", directPayment = "directPayment", extended = "extended" }

export type EnvironmentsProperty<T> = {[key in Environment]:T};
export type OperationsProperty<T> = {[key in Operation]:T};


export const DEFAULT_ENDPOINTS_PREFIX: EnvironmentsProperty<string> = {
    homologation: "https://homologation.payline.com/V4/services/",
    production: "https://services.payline.com/V4/services/",
};

export const DEFAULT_WSDLS_PREFIX: EnvironmentsProperty<string> = {
    homologation: path.join(__dirname, "wsdl/homologation") + "/",
    production: path.join(__dirname, "wsdl/production") + "/",
};

export const DEFAULT_WSDLS_NAME: OperationsProperty<string> = {
    webPayment: "WebPaymentAPI.wsdl",
    directPayment: "DirectPaymentAPI.wsdl",
    extended: "ExtendedAPI.wsdl",
};

export const MIN_AMOUNT = 100;
export const ACTIONS = {
    AUTHORIZATION: 100,
    PAYMENT: 101, // validation + payment
    VALIDATION: 201
};

export const CURRENCIES = {
    EUR: 978,
    USD: 840,
    GBP: 826
};
