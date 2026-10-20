import Fastify from 'fastify'

const app = Fastify({
    logger: true
})

app.get('/health', async () => {
    return {status: 'ok'}
})

app.get('/resposta', async () => {
    return {mensagem: 'greencode'}
})

try {
    await app.listen({ port: 3333, host: '0.0.0.0'})
} catch (erro) {
    app.log.error(erro)
    process.exit(1)
}