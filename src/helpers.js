require('dotenv').config()
const sqlite3 = require('sqlite3').verbose()
const { open } = require('sqlite')

const isAdmin = ctx => ctx.update.message.from.id === Number(process.env.ADMIN_ID)
const isGroup = ctx => ctx.update.message.chat.type === 'group'
const hasPhoto = ctx => ctx.update.message.reply_to_message.photo ? ctx.update.message.reply_to_message.photo.length > 0 : false
const hasPrice = ctx => ctx.update.message.reply_to_message.caption ? ctx.update.message.reply_to_message.caption.length > 0 : false
const getCurrDateTime = (d) =>
    d.getFullYear() +
    '-' +
    ('0' + d.getMonth()).slice(-2) +
    '-' +
    ('0' + d.getDay()).slice(-2) +
    ' ' +
    ('0' + d.getHours()).slice(-2) +
    ':' +
    ('0' + d.getMinutes()).slice(-2) +
    ':' +
    ('0' + d.getSeconds()).slice(-2)
const openDB = () => new sqlite3.Database(process.env.DATA_PATH + 'db.db', (err) => {
    if (err) {
        console.error('Database open error:\n' + err.message)
    }
})

const openDB2 = async () => {
    return open({
        filename: process.env.DATA_PATH + 'db.db',
        driver: sqlite3.Database
    })
}
const closeDB = (db) =>
    db.close((err) => {
        if (err) {
            console.error('Database close error:\n' + err.message)
        }
    })
const sendPhoto = (ctx, item, cost = false) =>
    ctx.replyWithPhoto(
        {
            source: `${process.env.DATA_PATH + 'items_photo/'}${item}.jpg`
        },
        {
            caption: cost ? `Цена: ${cost}р.` : `Цена: – р.`
        }
    )

module.exports = { isAdmin, hasPhoto, hasPrice, isGroup, openDB, openDB2, closeDB, getCurrDateTime, sendPhoto }
