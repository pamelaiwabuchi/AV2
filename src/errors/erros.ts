export class ErroApp extends Error {
    readonly statusCode: number;

    constructor(mensagem: string, statusCode: number) {
        super(mensagem);
        this.name = new.target.name;
        this.statusCode = statusCode;
    }
}

export class ErroNaoAutenticado extends ErroApp {
    constructor(mensagem = "É preciso fazer login") {
        super(mensagem, 401);
    }
}

export class ErroSemPermissao extends ErroApp {
    constructor(mensagem = "Você não tem permissão para esta ação") {
        super(mensagem, 403);
    }
}

export class ErroNaoEncontrado extends ErroApp {
    constructor(mensagem: string) {
        super(mensagem, 404);
    }
}

export class ErroConflito extends ErroApp {
    constructor(mensagem: string) {
        super(mensagem, 409);
    }
}

export class ErroRegraNegocio extends ErroApp {
    constructor(mensagem: string) {
        super(mensagem, 422);
    }
}
