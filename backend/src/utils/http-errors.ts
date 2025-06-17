class HttpError extends Error {
    public code: number;
    public extraData?: Record<string, any>;

    constructor(message: string, errorCode: number, extraData?: any) {
        super(message);
        this.code = errorCode;
        this.extraData = extraData;
    }
}

export default HttpError;
