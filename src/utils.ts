import { defineProperty, Session, Universal } from 'koishi'
import { DiscussMessage, GroupMessage, PrivateMessage } from 'oicq'
import { OICQBot } from './bot'
import { CQCode } from './cqcode'

type Message = PrivateMessage | GroupMessage | DiscussMessage

export async function adaptSession(bot: OICQBot, message: Message): Promise<Session>
export async function adaptSession(bot: OICQBot, message: Message, result: Universal.Message): Promise<Universal.Message>
export async function adaptSession(bot: OICQBot, message: Message, result?: Universal.Message) {
  const session = result || bot.session({ type: 'message' })
  session.userId = message.sender.user_id.toString()
  session.messageId = message.message_id
  if (message.message_type === 'group') {
    session.subtype = 'group'
    session.channelId = message.group_id.toString()
    session.guildId = session.channelId
  } else if (message.message_type === 'discuss') {
    session.subtype = 'group'
    session.channelId = message.discuss_id.toString()
    session.guildId = session.channelId
  } else {
    session.subtype = 'private'
    session.channelId = `private:${message.sender.user_id}`
  }
  if (message.source) {
    session.quote = {
      userId: message.source.user_id.toString(),
      content: message.source.message as string,
    }
  }
  const elements = CQCode.parse(message.toCqcode())
  session.content = elements.join('')
  // Universal Message Compat
  session.elements ??= elements
  return session
}

export async function dispatchSession(bot: OICQBot, message: Message) {
  const session = await adaptSession(bot, message)
  if (!session) return

  defineProperty(session, 'oicq', Object.create(message))
  session.oicq.client = bot.client
  bot.dispatch(session)
}
