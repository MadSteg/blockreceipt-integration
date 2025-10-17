import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlockReceiptAPI } from '../services/BlockReceiptAPI';
import { Receipt, LoyaltyProfile } from '../types';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: any) {
  const [recentReceipts, setRecentReceipts] = useState<Receipt[]>([]);
  const [loyaltyProfile, setLoyaltyProfile] = useState<LoyaltyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    loadData();
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

  const loadData = async () => {
    try {
      // Mock user ID - in production this would come from authentication
      const profileResponse = await BlockReceiptAPI.getLoyaltyProfile(1);
      if (profileResponse.success) {
        setLoyaltyProfile(profileResponse.data);
      }

      // Mock receipts - in production this would come from blockchain
      const receiptsResponse = await BlockReceiptAPI.getReceipts('0x123...');
      if (receiptsResponse.success) {
        setRecentReceipts(receiptsResponse.receipts.slice(0, 3));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneNumberSetup = () => {
    Alert.prompt(
      'Setup Wallet',
      'Enter your phone number to create your BlockReceipt wallet:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Setup', 
          onPress: (phoneNumber: string) => {
            if (phoneNumber) {
              navigation.navigate('WalletSetup', { phoneNumber });
            }
          }
        }
      ],
      'plain-text'
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingContent, { opacity: fadeAnim }]}>
          <Ionicons name="receipt" size={60} color="#6366f1" />
          <Text style={styles.loadingText}>Loading your receipts...</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Header with NFT Marketplace Style */}
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a', '#2a2a2a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>BlockReceipt</Text>
              <Text style={styles.subtitle}>Transform Receipts into NFTs</Text>
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Ionicons name="notifications-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {loyaltyProfile && (
            <View style={styles.loyaltyCard}>
              <View style={styles.loyaltyHeader}>
                <Ionicons name="gift" size={20} color="#10b981" />
                <Text style={styles.loyaltyTitle}>Loyalty Points</Text>
              </View>
              <Text style={styles.loyaltyPoints}>{loyaltyProfile.totalPoints.toLocaleString()}</Text>
              <Text style={styles.loyaltyTier}>{loyaltyProfile.tier.toUpperCase()} Member</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '75%' }]} />
              </View>
            </View>
          )}
        </Animated.View>
      </LinearGradient>

      {/* Quick Actions */}
      <Animated.View style={[styles.quickActions, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Receipts')}>
          <LinearGradient colors={['#10b981', '#059669']} style={styles.actionGradient}>
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={styles.actionText}>Scan Receipt</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Loyalty')}>
          <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.actionGradient}>
            <Ionicons name="gift" size={24} color="#fff" />
            <Text style={styles.actionText}>Rewards</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Profile')}>
          <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={styles.actionGradient}>
            <Ionicons name="person" size={24} color="#fff" />
            <Text style={styles.actionText}>Profile</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Setup Wallet Card */}
      {!loyaltyProfile && (
        <Animated.View style={[styles.setupCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient colors={['#10b981', '#059669']} style={styles.setupGradient}>
            <View style={styles.setupContent}>
              <Ionicons name="wallet" size={32} color="#fff" />
              <View style={styles.setupText}>
                <Text style={styles.setupTitle}>Setup Your Wallet</Text>
                <Text style={styles.setupSubtitle}>Start earning NFTs with every purchase</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.setupButton} onPress={handlePhoneNumberSetup}>
              <Text style={styles.setupButtonText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color="#10b981" />
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Recent Receipts Section */}
      <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Receipts</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Receipts')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {recentReceipts.length > 0 ? (
          recentReceipts.map((receipt, index) => (
            <Animated.View
              key={receipt.id}
              style={[
                styles.receiptCard,
                { 
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <TouchableOpacity 
                style={styles.receiptCardContent}
                onPress={() => navigation.navigate('ReceiptDetail', { receipt })}
              >
                <View style={styles.receiptIcon}>
                  <Ionicons name="receipt" size={24} color="#6366f1" />
                </View>
                <View style={styles.receiptInfo}>
                  <Text style={styles.merchantName}>{receipt.merchantName}</Text>
                  <Text style={styles.receiptDate}>{new Date(receipt.timestamp).toLocaleDateString()}</Text>
                </View>
                <View style={styles.receiptAmountContainer}>
                  <Text style={styles.receiptAmount}>${receipt.totalAmount.toFixed(2)}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyStateText}>No receipts yet</Text>
            <Text style={styles.emptyStateSubtext}>Scan your first receipt to get started</Text>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
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
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: -1,
    textShadowColor: '#6366f1',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#a0a0a0',
    marginTop: 8,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loyaltyCard: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 20,
    padding: 24,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  loyaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  loyaltyTitle: {
    fontSize: 14,
    color: '#a0a0a0',
    marginLeft: 8,
    fontWeight: '500',
  },
  loyaltyPoints: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 4,
    textShadowColor: '#6366f1',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  loyaltyTier: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 1,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -20,
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  setupCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  setupGradient: {
    padding: 20,
  },
  setupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  setupText: {
    marginLeft: 16,
    flex: 1,
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  setupSubtitle: {
    fontSize: 14,
    color: '#d1fae5',
  },
  setupButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupButtonText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
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
  receiptCard: {
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 20, 20, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  receiptCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  receiptIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  receiptInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  receiptDate: {
    fontSize: 14,
    color: '#a0a0a0',
    fontWeight: '400',
  },
  receiptAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366f1',
    marginRight: 8,
    textShadowColor: '#6366f1',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});

