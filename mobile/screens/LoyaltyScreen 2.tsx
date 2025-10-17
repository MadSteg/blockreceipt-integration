import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlockReceiptAPI } from '../services/BlockReceiptAPI';
import { LoyaltyProfile } from '../types';

const { width } = Dimensions.get('window');

export default function LoyaltyScreen() {
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    loadProfile();
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await BlockReceiptAPI.getLoyaltyProfile(1);
      if (response.success) {
        setProfile(response.data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingContent, { opacity: fadeAnim }]}>
          <Ionicons name="gift" size={60} color="#6366f1" />
          <Text style={styles.loadingText}>Loading your rewards...</Text>
        </Animated.View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.emptyState, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Ionicons name="gift-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyStateTitle}>No loyalty profile found</Text>
          <Text style={styles.emptyStateSubtitle}>Start scanning receipts to build your loyalty profile</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Header with Gradient */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6', '#a855f7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Loyalty Rewards</Text>
              <Text style={styles.subtitle}>Earn points with every purchase</Text>
            </View>
            <View style={styles.tierBadge}>
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.tierBadgeGradient}
              >
                <Ionicons name="star" size={16} color="#fff" />
                <Text style={styles.tierText}>{profile.tier.toUpperCase()}</Text>
              </LinearGradient>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* Points Card */}
      <Animated.View style={[styles.pointsCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <LinearGradient
          colors={['#10b981', '#059669']}
          style={styles.pointsCardGradient}
        >
          <View style={styles.pointsHeader}>
            <Ionicons name="gift" size={24} color="#fff" />
            <Text style={styles.pointsLabel}>Available Points</Text>
          </View>
          <Text style={styles.pointsValue}>{profile.availablePoints.toLocaleString()}</Text>
          <Text style={styles.totalPoints}>of {profile.totalPoints.toLocaleString()} total earned</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(profile.availablePoints / profile.totalPoints) * 100}%` }]} />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Stats Cards */}
      <Animated.View style={[styles.statsContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.statCard}>
          <LinearGradient colors={['#f3f4f6', '#e5e7eb']} style={styles.statCardGradient}>
            <Ionicons name="receipt" size={24} color="#6366f1" />
            <Text style={styles.statValue}>{profile.totalReceipts}</Text>
            <Text style={styles.statLabel}>Receipts</Text>
          </LinearGradient>
        </View>
        <View style={styles.statCard}>
          <LinearGradient colors={['#f3f4f6', '#e5e7eb']} style={styles.statCardGradient}>
            <Ionicons name="cash" size={24} color="#10b981" />
            <Text style={styles.statValue}>${profile.totalSpent.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </LinearGradient>
        </View>
        <View style={styles.statCard}>
          <LinearGradient colors={['#f3f4f6', '#e5e7eb']} style={styles.statCardGradient}>
            <Ionicons name="trending-up" size={24} color="#f59e0b" />
            <Text style={styles.statValue}>${profile.averageOrderValue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Avg Order</Text>
          </LinearGradient>
        </View>
      </Animated.View>

      {/* Recent Rewards */}
      <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Rewards</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        {profile.recentRewards.map((reward, index) => (
          <Animated.View
            key={reward.id}
            style={[
              styles.rewardCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <View style={styles.rewardIcon}>
              <Ionicons 
                name={reward.type === 'points' ? 'gift' : 'diamond'} 
                size={20} 
                color="#6366f1" 
              />
            </View>
            <View style={styles.rewardInfo}>
              <Text style={styles.rewardDescription}>{reward.description}</Text>
              <Text style={styles.rewardMerchant}>{reward.merchant}</Text>
            </View>
            <View style={styles.rewardValueContainer}>
              <Text style={styles.rewardValue}>+{reward.value}</Text>
              <Text style={styles.rewardType}>{reward.type}</Text>
            </View>
          </Animated.View>
        ))}
      </Animated.View>

      {/* Favorite Merchants */}
      <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Favorite Merchants</Text>
        </View>
        {profile.favoriteMerchants.map((merchant, index) => (
          <Animated.View
            key={merchant.merchantId}
            style={[
              styles.merchantCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <View style={styles.merchantHeader}>
              <View style={styles.merchantIcon}>
                <Ionicons name="storefront" size={20} color="#6366f1" />
              </View>
              <Text style={styles.merchantName}>{merchant.merchantName}</Text>
            </View>
            <View style={styles.merchantStats}>
              <View style={styles.merchantStatItem}>
                <Text style={styles.merchantStatValue}>{merchant.receipts}</Text>
                <Text style={styles.merchantStatLabel}>Receipts</Text>
              </View>
              <View style={styles.merchantStatItem}>
                <Text style={styles.merchantStatValue}>${merchant.spent.toFixed(0)}</Text>
                <Text style={styles.merchantStatLabel}>Spent</Text>
              </View>
              <View style={styles.merchantStatItem}>
                <Text style={styles.merchantStatValue}>{merchant.points}</Text>
                <Text style={styles.merchantStatLabel}>Points</Text>
              </View>
            </View>
          </Animated.View>
        ))}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6366f1',
    marginTop: 16,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e7ff',
    marginTop: 4,
    fontWeight: '400',
  },
  tierBadge: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tierBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tierText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  pointsCard: {
    marginHorizontal: 20,
    marginTop: -20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  pointsCardGradient: {
    padding: 24,
    alignItems: 'center',
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pointsLabel: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  pointsValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  totalPoints: {
    fontSize: 14,
    color: '#d1fae5',
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardGradient: {
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  seeAllText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  rewardCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  rewardMerchant: {
    fontSize: 14,
    color: '#6b7280',
  },
  rewardValueContainer: {
    alignItems: 'flex-end',
  },
  rewardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 2,
  },
  rewardType: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  merchantCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  merchantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  merchantIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  merchantStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  merchantStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  merchantStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  merchantStatLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
});
