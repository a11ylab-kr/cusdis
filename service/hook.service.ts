import { Comment, Page, Project } from "@prisma/client";
import { RequestScopeService } from ".";
import { NotificationService } from "./notification.service";
import { WebhookService } from "./webhook.service";

export class HookService extends RequestScopeService {

  notificationService = new NotificationService(this.req)
  webhookService = new WebhookService(this.req)

  async addComment(comment: Comment, projectId: string) {
    this.notificationService.addComment(comment, projectId)
    this.webhookService.addComment(comment, projectId)
  }

  async approveComment(comment: Comment) {
    try {
      await this.notificationService.addReply(comment)
    } catch (e) {
      console.error('[notification] failed to prepare reply email:', e)
    }
  }
}
