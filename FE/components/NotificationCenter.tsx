import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  data?: any;
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  readDividerIndex: number;
  hasMore: boolean;
  loadingMore: boolean;
  markAllAsRead: () => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  readDividerIndex: 0,
  hasMore: false,
  loadingMore: false,
  markAllAsRead: async () => undefined,
  loadMoreNotifications: async () => undefined,
});

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  company_settings_changed: 'settings-outline',
  leave_request_created: 'calendar-outline',
  personnel_created: 'people-outline',
  member_approved: 'person-add-outline',
  member_removed: 'person-remove-outline',
  custom_announcement: 'megaphone-outline',
};

const TYPE_COLOR: Record<string, string> = {
  company_settings_changed: '#2563eb',
  leave_request_created: '#7c3aed',
  personnel_created: '#15803d',
  member_approved: '#0f766e',
  member_removed: '#b91c1c',
  custom_announcement: '#c2410c',
};

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
};

const formatWorkHours = (data: any) => {
  if (data?.work_hours_label) return data.work_hours_label;
  if (!data?.work_start_time || !data?.work_end_time) return null;
  return `${String(data.work_start_time).slice(0, 5)} - ${String(data.work_end_time).slice(0, 5)}`;
};

const getNotificationDetails = (item: AppNotification) => {
  if (item.type === 'company_settings_changed') {
    const details: [string, string][] = [];
    const hasField = (field: string) => Object.prototype.hasOwnProperty.call(item.data || {}, field);

    if (hasField('work_hours_label') || hasField('work_start_time') || hasField('work_end_time')) {
      const workHours = formatWorkHours(item.data);
      if (workHours) details.push(['Giờ hành chính', workHours]);
    }
    if (hasField('flexible_minutes')) {
      details.push([
        'Thời gian linh động',
        Number(item.data.flexible_minutes || 0) > 0 ? `${item.data.flexible_minutes} phút` : 'Không áp dụng',
      ]);
    }
    if (hasField('max_leave_days')) {
      details.push(['Quỹ nghỉ phép', `${item.data.max_leave_days} ngày/năm`]);
    }
    if (hasField('leave_request_deadline_days')) {
      details.push(['Hạn gửi đơn (Ngày)', `${Number(item.data.leave_request_deadline_days || 0)} ngày`]);
    }
    if (hasField('leave_request_deadline_hours')) {
      details.push(['Hạn gửi đơn (Giờ)', `${Number(item.data.leave_request_deadline_hours || 0)} giờ`]);
    }
    if (hasField('leave_policy_name')) {
      details.push(['Chính sách', item.data.leave_policy_name]);
    }
    if (hasField('leave_policy_period_type')) {
      details.push(['Loại', item.data.leave_policy_period_type === 'monthly' ? 'Theo tháng' : 'Theo năm']);
    }
    if (hasField('leave_policy_days')) {
      details.push(['Số ngày nghỉ', `${Number(item.data.leave_policy_days || 0)} ngày`]);
    }
    if (hasField('leave_policy_require_approval')) {
      details.push(['Cần duyệt', item.data.leave_policy_require_approval ? 'Có' : 'Không']);
    }

    return details;
  }

  if (item.type === 'personnel_created') {
    return [
      ['Bộ phận', item.data?.department_name || 'Chưa có bộ phận'],
    ];
  }

  if (item.type === 'custom_announcement') {
    return [
      ['Người đăng', item.data?.author_name || null],
    ].filter((detail): detail is [string, string] => Boolean(detail[1]));
  }

  return [];
};

export const useCompanyNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, user, company, refreshSession } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readDividerIndex, setReadDividerIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const notificationIdsRef = useRef<Set<string>>(new Set());
  const initialLoadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const markedReadLocallyRef = useRef(false);

  const companyId = company?.company_id;
  const streamUrl = useMemo(() => {
    if (!token || !companyId) return null;
    return `${API_URL}/api/notifications/stream?company_id=${encodeURIComponent(companyId)}&token=${encodeURIComponent(token)}`;
  }, [token, companyId]);

  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    setReadDividerIndex(0);
    setHasMore(false);
    setLoadingMore(false);
    notificationIdsRef.current = new Set();
    initialLoadingRef.current = false;
    loadingMoreRef.current = false;
    markedReadLocallyRef.current = false;
  }, [companyId]);

  useEffect(() => {
    if (!token || !companyId) return;
    if (initialLoadingRef.current) return;

    initialLoadingRef.current = true;
    fetch(`${API_URL}/api/notifications?company_id=${encodeURIComponent(companyId)}&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : { notifications: [] })
      .then(data => {
        const loadedNotifications = data.notifications || [];
        notificationIdsRef.current = new Set(loadedNotifications.map((item: AppNotification) => item.id));
        setNotifications(loadedNotifications);
        setUnreadCount(current => markedReadLocallyRef.current ? current : (data.unreadCount || 0));
        setReadDividerIndex(current => markedReadLocallyRef.current ? current : (data.unreadCount || 0));
        setHasMore(Boolean(data.hasMore));
      })
      .catch(() => undefined)
      .finally(() => {
        initialLoadingRef.current = false;
      });
  }, [token, companyId]);

  const loadMoreNotifications = async () => {
    if (!token || !companyId || !hasMore || loadingMoreRef.current || notifications.length === 0) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const oldestNotification = notifications[notifications.length - 1];
      const res = await fetch(
        `${API_URL}/api/notifications?company_id=${encodeURIComponent(companyId)}&limit=10&before_id=${encodeURIComponent(oldestNotification.id)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;

      const data = await res.json();
      const nextNotifications = data.notifications || [];
      const uniqueNext = nextNotifications.filter((item: AppNotification) => {
        if (notificationIdsRef.current.has(item.id)) return false;
        notificationIdsRef.current.add(item.id);
        return true;
      });
      setNotifications(prev => [...prev, ...uniqueNext]);
      setHasMore(Boolean(data.hasMore));
    } catch {
      undefined;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const markAllAsRead = async () => {
    if (!token || !companyId) return;
    markedReadLocallyRef.current = true;
    setReadDividerIndex(current => unreadCount > 0 ? unreadCount : current);
    setUnreadCount(0);
    try {
      const res = await fetch(`${API_URL}/api/notifications/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ company_id: companyId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
    } catch {
      undefined;
    }
  };

  useEffect(() => {
    const EventSourceCtor = (globalThis as any).EventSource;
    if (!streamUrl || !EventSourceCtor) return undefined;

    const source = new EventSourceCtor(streamUrl);
    source.addEventListener('notification', (event: MessageEvent) => {
      const notification = JSON.parse(event.data) as AppNotification;
      if (notificationIdsRef.current.has(notification.id)) return;
      notificationIdsRef.current.add(notification.id);
      setNotifications(prev => [notification, ...prev].slice(0, 50));
      setUnreadCount(count => count + 1);
      setReadDividerIndex(index => index + 1);
      if (
        notification.type === 'company_settings_changed' ||
        (notification.type === 'member_removed' && String(notification.data?.user_id) === String(user?.id))
      ) {
        refreshSession?.().catch(() => undefined);
      }
    });

    source.onerror = () => undefined;

    return () => {
      source.close();
    };
  }, [streamUrl, refreshSession, user?.id]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        readDividerIndex,
        hasMore,
        loadingMore,
        markAllAsRead,
        loadMoreNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

const renderNotification = (item: AppNotification) => {
  const color = TYPE_COLOR[item.type] || '#334155';
  const details = getNotificationDetails(item);
  return (
    <View key={item.id} style={styles.notificationItem}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={TYPE_ICON[item.type] || 'notifications-outline'} size={20} color={color} />
      </View>
      <View style={styles.notificationBody}>
        <View style={styles.notificationTop}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationTime}>{formatTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        {details.length > 0 && (
          <View style={styles.detailBox}>
            {details.map(([label, value]) => (
              <View key={label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const NotificationCenter = () => {
  const {
    notifications,
    readDividerIndex,
    hasMore,
    loadingMore,
    markAllAsRead,
    loadMoreNotifications,
  } = useCompanyNotifications();
  const { token, company } = useAuth();
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canCreateNotification = company?.role === 'owner' || company?.role === 'manager';

  useEffect(() => {
    markAllAsRead();
  }, []);

  const handleSubmitCustomNotification = async () => {
    if (!customTitle.trim() || !customMessage.trim()) {
      alert('Vui lòng nhập tiêu đề và nội dung thông báo');
      return;
    }
    if (!token || !company?.company_id) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications/custom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          company_id: company.company_id,
          title: customTitle.trim(),
          message: customMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể tạo thông báo');
        return;
      }
      setCustomTitle('');
      setCustomMessage('');
      setShowComposer(false);
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  const renderNotificationList = () => {
    if (notifications.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={34} color="#94a3b8" />
          <Text style={styles.emptyTitle}>Chưa có thông báo mới</Text>
          <Text style={styles.emptyText}>Thông báo mới của công ty sẽ xuất hiện tại đây.</Text>
        </View>
      );
    }

    const dividerIndex = Math.max(0, Math.min(readDividerIndex, notifications.length));
    const shouldShowReadDivider = dividerIndex > 0 && dividerIndex < notifications.length;

    if (!shouldShowReadDivider) {
      return <>{notifications.map(renderNotification)}</>;
    }

    return (
      <>
        {notifications.slice(0, dividerIndex).map(renderNotification)}
        <View style={styles.readDivider}>
          <View style={styles.readDividerLine} />
          <Text style={styles.readDividerText}>Đã đọc</Text>
          <View style={styles.readDividerLine} />
        </View>
        {notifications.slice(dividerIndex).map(renderNotification)}
      </>
    );
  };

  const handleNotificationScroll = ({ nativeEvent }: any) => {
    const paddingToBottom = 80;
    const distanceFromBottom = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y;
    if (distanceFromBottom >= nativeEvent.contentSize.height - paddingToBottom) {
      loadMoreNotifications();
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Thông báo công ty</Text>
          <Text style={styles.subtitle}>Các cập nhật chung về cài đặt, đơn nghỉ phép và nhân sự.</Text>
        </View>
        {canCreateNotification && (
          <TouchableOpacity style={styles.openComposerBtn} onPress={() => setShowComposer(true)}>
            <Ionicons name="megaphone-outline" size={16} color="#fff" />
            <Text style={styles.openComposerText}>Tạo thông báo</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
        persistentScrollbar
        scrollEventThrottle={250}
        onScroll={handleNotificationScroll}
      >
        {renderNotificationList()}
        {notifications.length > 0 && (
          <View style={styles.loadMoreState}>
            {loadingMore ? (
              <>
                <ActivityIndicator size="small" color="#4a72b5" />
                <Text style={styles.loadMoreText}>Đang tải thêm...</Text>
              </>
            ) : !hasMore ? (
              <Text style={styles.loadMoreText}>Đã hiển thị hết thông báo</Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal visible={showComposer} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.composerTitleRow}>
                <Ionicons name="megaphone-outline" size={18} color="#4a72b5" />
                <Text style={styles.composerTitle}>Tạo thông báo tùy chỉnh</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setShowComposer(false);
                  setCustomTitle('');
                  setCustomMessage('');
                }}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.titleInput}
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder="Tiêu đề thông báo"
              maxLength={120}
            />
            <TextInput
              style={styles.messageInput}
              value={customMessage}
              onChangeText={setCustomMessage}
              placeholder="Nội dung thông báo..."
              multiline
              textAlignVertical="top"
            />
            <View style={styles.composerFooter}>
              <Text style={styles.composerHint}>Thông báo sẽ được gửi tới toàn bộ công ty.</Text>
              <TouchableOpacity style={styles.sendBtn} onPress={handleSubmitCustomNotification} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={16} color="#fff" />
                    <Text style={styles.sendBtnText}>Gửi thông báo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: '#64748b',
  },
  openComposerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#4a72b5',
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    minHeight: 38,
  },
  openComposerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
    shadowColor: '#111827',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  composerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  composerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  titleInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 11,
    fontSize: 14,
    marginBottom: 10,
  },
  messageInput: {
    minHeight: 82,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 14,
  },
  composerFooter: {
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  composerHint: {
    flex: 1,
    color: '#64748b',
    fontSize: 12,
  },
  sendBtn: {
    minWidth: 132,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#4a72b5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  list: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  listContent: {
    paddingBottom: 8,
  },
  readDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  readDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#111827',
  },
  readDividerText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  loadMoreState: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  loadMoreText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  notificationItem: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationBody: {
    flex: 1,
  },
  notificationTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  notificationTime: {
    fontSize: 12,
    color: '#64748b',
  },
  notificationMessage: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
  },
  detailBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    gap: 7,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    color: '#111827',
    fontWeight: 'bold',
  },
  emptyState: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
  },
  emptyText: {
    marginTop: 5,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default NotificationCenter;
