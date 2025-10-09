/**
 * Workflow Notifications API
 * Handles workflow timeout notifications and event subscriptions
 * Implements requirement 4.4 (workflow timeout and notification system)
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateWorkflowRead,
  authenticateWorkflowUpdate,
  createApiResponse,
  createErrorResponse
} from '@/lib/workflow-auth-middleware';
import { workflowStateManager } from '@/workflows/workflow-state';
import { WorkflowStatus } from '@/types/workflow';

interface RouteParams {
  params: {
    id: string;
  };
}

interface NotificationRule {
  id: string;
  workflow_id: string;
  event_type: 'timeout' | 'status_change' | 'error' | 'completion' | 'step_completion';
  conditions: Record<string, any>;
  notification_method: 'email' | 'webhook' | 'in_app';
  notification_target: string;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

// In-memory notification rules storage (in production, this would be in a database)
const notificationRules = new Map<string, NotificationRule[]>();
const notificationHistory = new Map<string, any[]>();

/**
 * GET /api/workflows/[id]/notifications - Get notification rules and history
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const workflowId = params.id;
    const auth = await authenticateWorkflowRead(request, workflowId);
    if (!auth.success) return auth.error!;

    const { session, workflowState } = auth.data!;

    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('include_history') === 'true';
    const eventType = searchParams.get('event_type');

    // Get notification rules for this workflow
    let rules = notificationRules.get(workflowId) || [];
    
    // Filter by event type if specified
    if (eventType) {
      rules = rules.filter(rule => rule.event_type === eventType);
    }

    const response: any = {
      workflow_id: workflowId,
      notification_rules: rules,
      active_rules_count: rules.filter(r => r.is_active).length,
      tenant_id: session.user.tenantId
    };

    // Include notification history if requested
    if (includeHistory) {
      const history = notificationHistory.get(workflowId) || [];
      response.notification_history = history.slice(-50); // Last 50 notifications
      response.total_notifications_sent = history.length;
    }

    // Check for pending timeout notifications
    const timeoutInfo = checkTimeoutStatus(workflowState);
    if (timeoutInfo.is_approaching_timeout || timeoutInfo.is_timed_out) {
      response.timeout_status = timeoutInfo;
    }

    return createApiResponse('success', response);

  } catch (error) {
    console.error(`Failed to get workflow notifications:`, error);
    return createErrorResponse(
      'Failed to get workflow notifications',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * POST /api/workflows/[id]/notifications - Create or trigger notifications
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const workflowId = params.id;
    const auth = await authenticateWorkflowUpdate(request, workflowId);
    if (!auth.success) return auth.error!;

    const { session, workflowState } = auth.data!;

    const body = await request.json();
    const { action, rule, notification } = body;

    if (!action || !['create_rule', 'trigger_notification', 'send_timeout_warning'].includes(action)) {
      return createErrorResponse(
        'Invalid action',
        'Action must be one of: create_rule, trigger_notification, send_timeout_warning',
        400
      );
    }

    let result: any = {
      workflow_id: workflowId,
      action,
      timestamp: new Date().toISOString(),
      tenant_id: session.user.tenantId
    };

    switch (action) {
      case 'create_rule':
        if (!rule || !rule.event_type || !rule.notification_method) {
          return createErrorResponse(
            'Invalid rule',
            'Rule must include event_type and notification_method',
            400
          );
        }

        const newRule: NotificationRule = {
          id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          workflow_id: workflowId,
          event_type: rule.event_type,
          conditions: rule.conditions || {},
          notification_method: rule.notification_method,
          notification_target: rule.notification_target || session.user.email || '',
          is_active: rule.is_active !== false,
          created_at: new Date().toISOString(),
          created_by: session.user.id
        };

        // Validate rule configuration
        const validationError = validateNotificationRule(newRule);
        if (validationError) {
          return createErrorResponse('Invalid rule configuration', validationError, 400);
        }

        // Store the rule
        const existingRules = notificationRules.get(workflowId) || [];
        existingRules.push(newRule);
        notificationRules.set(workflowId, existingRules);

        result.rule_created = true;
        result.rule_id = newRule.id;
        result.rule = newRule;
        break;

      case 'trigger_notification':
        if (!notification || !notification.event_type) {
          return createErrorResponse(
            'Invalid notification',
            'Notification must include event_type',
            400
          );
        }

        const triggeredNotifications = await triggerNotifications(
          workflowId,
          notification.event_type,
          notification.event_data || {},
          session.user.id
        );

        result.notifications_triggered = triggeredNotifications.length;
        result.notifications = triggeredNotifications;
        break;

      case 'send_timeout_warning':
        const timeoutInfo = checkTimeoutStatus(workflowState);
        
        if (!timeoutInfo.is_approaching_timeout && !timeoutInfo.is_timed_out) {
          return createErrorResponse(
            'No timeout warning needed',
            'Workflow is not approaching timeout',
            400
          );
        }

        const timeoutNotifications = await triggerNotifications(
          workflowId,
          'timeout',
          {
            timeout_info: timeoutInfo,
            workflow_status: workflowState.status,
            current_step: workflowState.current_step
          },
          session.user.id
        );

        result.timeout_warning_sent = true;
        result.notifications_sent = timeoutNotifications.length;
        result.timeout_info = timeoutInfo;
        break;
    }

    return createApiResponse('success', result);

  } catch (error) {
    console.error(`Failed to handle workflow notification:`, error);
    return createErrorResponse(
      'Failed to handle workflow notification',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * PUT /api/workflows/[id]/notifications - Update notification rules
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const workflowId = params.id;
    const auth = await authenticateWorkflowUpdate(request, workflowId);
    if (!auth.success) return auth.error!;

    const { session } = auth.data!;

    const body = await request.json();
    const { rule_id, updates } = body;

    if (!rule_id || !updates) {
      return createErrorResponse(
        'Missing parameters',
        'rule_id and updates are required',
        400
      );
    }

    const rules = notificationRules.get(workflowId) || [];
    const ruleIndex = rules.findIndex(r => r.id === rule_id);

    if (ruleIndex === -1) {
      return createErrorResponse(
        'Rule not found',
        `Notification rule ${rule_id} not found`,
        404
      );
    }

    // Update the rule
    const updatedRule = {
      ...rules[ruleIndex],
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: session.user.id
    };

    // Validate updated rule
    const validationError = validateNotificationRule(updatedRule);
    if (validationError) {
      return createErrorResponse('Invalid rule configuration', validationError, 400);
    }

    rules[ruleIndex] = updatedRule;
    notificationRules.set(workflowId, rules);

    return createApiResponse('success', {
      workflow_id: workflowId,
      rule_updated: true,
      rule_id,
      updated_rule: updatedRule,
      tenant_id: session.user.tenantId
    });

  } catch (error) {
    console.error(`Failed to update notification rule:`, error);
    return createErrorResponse(
      'Failed to update notification rule',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * DELETE /api/workflows/[id]/notifications - Delete notification rules
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const workflowId = params.id;
    const auth = await authenticateWorkflowUpdate(request, workflowId);
    if (!auth.success) return auth.error!;

    const { session } = auth.data!;

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('rule_id');
    const deleteAll = searchParams.get('delete_all') === 'true';

    if (!ruleId && !deleteAll) {
      return createErrorResponse(
        'Missing parameter',
        'Either rule_id or delete_all=true is required',
        400
      );
    }

    const rules = notificationRules.get(workflowId) || [];
    let deletedCount = 0;

    if (deleteAll) {
      deletedCount = rules.length;
      notificationRules.set(workflowId, []);
    } else {
      const filteredRules = rules.filter(r => r.id !== ruleId);
      deletedCount = rules.length - filteredRules.length;
      notificationRules.set(workflowId, filteredRules);
    }

    if (deletedCount === 0) {
      return createErrorResponse(
        'No rules deleted',
        ruleId ? `Rule ${ruleId} not found` : 'No rules to delete',
        404
      );
    }

    return createApiResponse('success', {
      workflow_id: workflowId,
      rules_deleted: deletedCount,
      deleted_rule_id: ruleId,
      tenant_id: session.user.tenantId
    });

  } catch (error) {
    console.error(`Failed to delete notification rule:`, error);
    return createErrorResponse(
      'Failed to delete notification rule',
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
}

/**
 * Check workflow timeout status
 */
function checkTimeoutStatus(workflowState: any) {
  const timeoutThreshold = 24 * 60 * 60 * 1000; // 24 hours
  const warningThreshold = timeoutThreshold * 0.8; // 80% of timeout (19.2 hours)
  
  const timeSinceUpdate = Date.now() - workflowState.updated_at.getTime();
  
  return {
    timeout_threshold_ms: timeoutThreshold,
    warning_threshold_ms: warningThreshold,
    time_since_update_ms: timeSinceUpdate,
    is_approaching_timeout: timeSinceUpdate > warningThreshold && timeSinceUpdate < timeoutThreshold,
    is_timed_out: timeSinceUpdate > timeoutThreshold,
    time_until_timeout_ms: Math.max(0, timeoutThreshold - timeSinceUpdate),
    severity: timeSinceUpdate > timeoutThreshold ? 'critical' : 
              timeSinceUpdate > warningThreshold ? 'warning' : 'normal'
  };
}

/**
 * Validate notification rule configuration
 */
function validateNotificationRule(rule: NotificationRule): string | null {
  const validEventTypes = ['timeout', 'status_change', 'error', 'completion', 'step_completion'];
  const validNotificationMethods = ['email', 'webhook', 'in_app'];

  if (!validEventTypes.includes(rule.event_type)) {
    return `Invalid event_type. Must be one of: ${validEventTypes.join(', ')}`;
  }

  if (!validNotificationMethods.includes(rule.notification_method)) {
    return `Invalid notification_method. Must be one of: ${validNotificationMethods.join(', ')}`;
  }

  if (rule.notification_method === 'email' && !rule.notification_target.includes('@')) {
    return 'Invalid email address for email notification method';
  }

  if (rule.notification_method === 'webhook' && !rule.notification_target.startsWith('http')) {
    return 'Invalid webhook URL for webhook notification method';
  }

  return null;
}

/**
 * Trigger notifications based on event type and rules
 */
async function triggerNotifications(
  workflowId: string,
  eventType: string,
  eventData: any,
  triggeredBy: string
): Promise<any[]> {
  const rules = notificationRules.get(workflowId) || [];
  const applicableRules = rules.filter(rule => 
    rule.is_active && 
    rule.event_type === eventType &&
    evaluateRuleConditions(rule.conditions, eventData)
  );

  const notifications = [];

  for (const rule of applicableRules) {
    try {
      const notification = await sendNotification(rule, eventData, triggeredBy);
      notifications.push(notification);
      
      // Store notification in history
      const history = notificationHistory.get(workflowId) || [];
      history.push(notification);
      notificationHistory.set(workflowId, history);
      
    } catch (error) {
      console.error(`Failed to send notification for rule ${rule.id}:`, error);
      notifications.push({
        rule_id: rule.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  return notifications;
}

/**
 * Evaluate rule conditions against event data
 */
function evaluateRuleConditions(conditions: Record<string, any>, eventData: any): boolean {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true; // No conditions means always trigger
  }

  // Simple condition evaluation (in production, this would be more sophisticated)
  for (const [key, expectedValue] of Object.entries(conditions)) {
    const actualValue = eventData[key];
    if (actualValue !== expectedValue) {
      return false;
    }
  }

  return true;
}

/**
 * Send notification based on method
 */
async function sendNotification(
  rule: NotificationRule,
  eventData: any,
  triggeredBy: string
): Promise<any> {
  const notification: any = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    rule_id: rule.id,
    workflow_id: rule.workflow_id,
    event_type: rule.event_type,
    notification_method: rule.notification_method,
    notification_target: rule.notification_target,
    event_data: eventData,
    triggered_by: triggeredBy,
    timestamp: new Date().toISOString(),
    success: false,
    delivery_attempts: 1
  };

  switch (rule.notification_method) {
    case 'email':
      // In production, this would integrate with an email service
      console.log(`[EMAIL] Sending notification to ${rule.notification_target}:`, {
        subject: `Workflow ${rule.workflow_id} - ${rule.event_type}`,
        body: JSON.stringify(eventData, null, 2)
      });
      notification.success = true;
      notification.delivery_method = 'simulated_email';
      break;

    case 'webhook':
      // In production, this would make an HTTP request to the webhook URL
      console.log(`[WEBHOOK] Sending notification to ${rule.notification_target}:`, eventData);
      notification.success = true;
      notification.delivery_method = 'simulated_webhook';
      break;

    case 'in_app':
      // In production, this would store the notification for in-app display
      console.log(`[IN_APP] Creating in-app notification:`, eventData);
      notification.success = true;
      notification.delivery_method = 'in_app_queue';
      break;

    default:
      throw new Error(`Unsupported notification method: ${rule.notification_method}`);
  }

  return notification;
}