require('dotenv').config()
const { Telegraf } = require('telegraf')
const { isAdmin, hasPhoto, isGroup, openDB, openDB2, closeDB, getCurrDateTime, sendPhoto } = require('./helpers')
const axios = require('axios')
const fs = require('fs')

const bot = new Telegraf(process.env.BOT_API)

bot.start(async ctx => {
    if (!isGroup(ctx))
        await ctx.replyWithMarkdown(`Привет!\n\nЯ виртуальный Помощник Ани по оформлению заказов и работаю только в [общем чате](${process.env.CHAT_HREF})😊`)
    else return ctx
})

bot.hears(['!Конец', '!конец'], async ctx => {
    try {
        if (isAdmin(ctx) && !isGroup(ctx)) {
            const db = await openDB2()
            const result = await db.run(`UPDATE Orders SET isActive=0 WHERE isActive=1`)
            if (result) {
                if (result.changes > 0) ctx.reply('Успешно!')
                else ctx.reply('Нет заказов для их закрытия!')
            }
        }
    } catch (e) {
        await bot.telegram.sendMessage(
            process.env.SUPPORT_ID,
            e
        )
    }
})

bot.hears(['!Заказы', '!заказы'], async ctx => {
    try {
        if (isAdmin(ctx) && !isGroup(ctx)) {

            const db = await openDB2()
            const orders = await db.all(`SELECT * FROM Orders WHERE isActive=1`)
            let finalSummary = 0

            if (orders.length) {
                for (let i = 0; i < orders.length; i++) {
                    const user = await db.get(`SELECT * FROM Users WHERE id=${orders[i].clientId}`)
                    await ctx.reply(
                        `${user.firstname} ${user.lastname}${user.username !== undefined && user.username !== 'undefined' ? ' @' + user.username : ''}\n`
                    )
                    const itemsArr = orders[i].cart.split(',')
                    let summary = 0
                    for (let j = 0; j < itemsArr.length; j++) {
                        const item = await db.get(`SELECT * FROM Items WHERE files=${itemsArr[j]}`)
                        const { cost, itemGroup } = item
                        if (+cost) {
                            await sendPhoto(ctx, itemsArr[j], cost)
                            summary = summary + (+cost)
                        } else if (itemGroup) {
                            const itemWithCost = await db.get(`SELECT * FROM Items WHERE itemGroup=${itemGroup} AND cost!=0`)
                            if (itemWithCost) {
                                await sendPhoto(ctx, itemsArr[j], itemWithCost.cost)
                                summary = summary + (+itemWithCost.cost)
                            }
                        } else {
                            await sendPhoto(ctx, itemsArr[j])
                        }
                    }
                    await ctx.reply(
                        `Итого: ${summary}р.\n`
                    )
                    finalSummary = finalSummary + summary
                     await ctx.reply('=================================\n')
                     if (!(i < orders.length-1)) await ctx.reply(`Итого всего: ${finalSummary}р.\n`)
                }
            } else {
                return ctx.reply('Сейчас заказов нет😢')
            }
            await db.close()
        } else if (!isGroup(ctx)){
            return ctx.replyWithMarkdown(`Я работаю только в [общем чате](${process.env.CHAT_HREF})`)
        } else {
            return ctx
        }
    } catch (e) {
        await bot.telegram.sendMessage(
            process.env.SUPPORT_ID,
            e
        )
    }
})

bot.use(async (ctx, next) => {
    try {
        console.log(ctx.update.message)

        if (isGroup(ctx))
            return next()
        else
            return ctx.replyWithMarkdown(`Привет!\nЯ работаю только в [общем чате](${process.env.CHAT_HREF})`)
    } catch (e) {
        await bot.telegram.sendMessage(
            process.env.SUPPORT_ID,
            e
        )
    }
})

bot.hears(['Беру', 'беру'], async ctx => {
    try {
        if (ctx.update.message.reply_to_message !== undefined)
            if (hasPhoto(ctx)) {

                const clientId = ctx.update.message.from.id ? ctx.update.message.from.id : null
                const {first_name, last_name, username} = ctx.update.message.from
                const group = ctx.update.message.reply_to_message.media_group_id ? ctx.update.message.reply_to_message.media_group_id : 0
                const item = ctx.update.message.reply_to_message.message_id ? ctx.update.message.reply_to_message.message_id : null

                const db = openDB()
                db.get(
                    `SELECT * FROM Users WHERE id=${clientId}`,
                    (err, row) => {
                        if (err) {
                            return console.error('SELECT * FROM Users error:\n' + err.message)
                        }
                        if (!row) {
                            db.all(
                                `INSERT INTO Users (id, firstname, lastname, username) VALUES (${clientId}, '${first_name}', '${last_name}', '${username}')`,
                                [],
                                (err) => {
                                    if (err) {
                                        return console.error('Database INSERT INTO Users error:\n' + err.message)
                                    }
                                }
                            )
                        }
                    }
                )
                db.get(
                    `SELECT * FROM Orders WHERE clientId=${clientId} AND isActive=1`,
                    (err, row) => {
                        if (err) {
                            return console.error('Database SELECT * FROM Orders error:\n' + err.message)
                        }
                        if (row) {
                            db.all(
                                `UPDATE Orders SET cart='${row.cart},${item}' WHERE clientId=${clientId}`,
                                [],
                                (err) => {
                                    if (err) {
                                        return console.error('Database UPDATE Orders error:\n' + err.message)
                                    }
                                }
                            )
                        } else {
                            db.all(
                                `INSERT INTO Orders (clientId, cart, isActive) VALUES (${clientId}, '${item}', 1)`,
                                [],
                                (err) => {
                                    if (err) {
                                        return console.error('Database INSERT INTO Orders error:\n' + err.message)
                                    }
                                }
                            )
                        }
                    }
                )
                closeDB(db)

                ctx.reply('👍')
            }
    } catch (e) {
        await bot.telegram.sendMessage(
            process.env.SUPPORT_ID,
            e
        )
    }
})

bot.hears(['!Правила', '!правила'], async ctx => {
    try {
        if (isAdmin(ctx)) {
            ctx.reply('Правила чата:\n<тут будут правила чата>')
        }
    } catch (e) {
        await bot.telegram.sendMessage(
            process.env.SUPPORT_ID,
            e
        )
    }
})

bot.on('message', async ctx => {

    try {
        if (ctx.update.message.photo && isAdmin(ctx)) {

            const cost = ctx.update.message.caption ? ctx.update.message.caption : 0
            const group = ctx.update.message.media_group_id ? ctx.update.message.media_group_id : 0

            if (cost || (!cost && group)) {
                //могут быть проблемы с размером файла из-за ограниченного хранилища
                const files = ctx.update.message.photo
                const fileId = files[files.length - 1].file_id

                ctx.telegram.getFileLink(fileId).then(url => {
                    axios({url: url.href, responseType: 'stream'}).then(response => {
                        return new Promise((resolve, reject) => {
                            const file = ctx.update.message.message_id

                            response.data.pipe(fs.createWriteStream(`/Users/kelfish/Projects/anna-book/data/items_photo/${file}.jpg`))
                                .on('finish', () => {
                                    const db = openDB()
                                    db.all(
                                        `INSERT INTO Items (itemGroup, cost, files, writeDateTime) VALUES (${group}, '${cost}', '${file}', '${getCurrDateTime(new Date())}')`,
                                        [],
                                        (err) => {
                                            if (err) {
                                                console.error('Database INSERT INTO Items error:\n' + err.message)
                                            }
                                        }
                                    )
                                    closeDB(db)
                                })
                                .on('error', e =>
                                    reject(
                                        ctx.reply('An error has occurred:\n', e)
                                    )
                                )
                        })
                    })
                })
            }
        }
    } catch (e) {
        await bot.telegram.sendMessage(
            process.env.SUPPORT_ID,
            e
        )
    }
})

bot.launch()
console.log('Bot started!')
