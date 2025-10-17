import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { BlockReceiptAPI } from '../services/BlockReceiptAPI';
import { Receipt } from '../types';

const { width } = Dimensions.get('window');

export default function ReceiptsScreen({ navigation }: any) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    loadReceipts();
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

  const loadReceipts = async () => {
    try {
      const response = await BlockReceiptAPI.getReceipts('0x123...');
      if (response.success) {
        setReceipts(response.receipts);
      }
    } catch (error) {
      console.error('Error loading receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScanReceipt = async () => {
    try {
      setScanning(true);
      
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera permissions to scan receipts!');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        // Here you would typically send the image to your backend for OCR processing
        console.log('Receipt scanned:', result.assets[0].uri);
        
        // Simulate processing
        setTimeout(() => {
          setScanning(false);
          // Navigate to receipt detail or show success message
          alert('Receipt scanned successfully! Processing...');
        }, 2000);
      } else {
        setScanning(false);
      }
    } catch (error) {
      console.error('Error scanning receipt:', error);
      setScanning(false);
    }
  };

  const renderReceipt = ({ item, index }: { item: Receipt; index: number }) => (
    <Animated.View
      style={[
        styles.receiptCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.receiptCardContent}
        onPress={() => navigation.navigate('ReceiptDetail', { receipt: item })}
      >
        <View style={styles.receiptImageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.receiptImage} />
          ) : (
            <View style={styles.receiptImagePlaceholder}>
              <Ionicons name="receipt" size={24} color="#6366f1" />
            </View>
          )}
          <View style={styles.nftBadge}>
            <Ionicons name="diamond" size={12} color="#fff" />
          </View>
        </View>
        
        <View style={styles.receiptInfo}>
          <Text style={styles.merchantName}>{item.merchantName}</Text>
          <Text style={styles.receiptDate}>
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
          <View style={styles.receiptFooter}>
            <View style={styles.pointsContainer}>
              <Ionicons name="gift" size={14} color="#10b981" />
              <Text style={styles.pointsText}>{item.loyaltyPoints} pts</Text>
            </View>
            <Text style={styles.receiptAmount}>${item.totalAmount.toFixed(2)}</Text>
          </View>
        </View>
        
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </TouchableOpacity>
    </Animated.View>
  );

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
    <View style={styles.container}>
      {/* Header with Scan Button */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        style={styles.header}
      >
        <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Your Receipts</Text>
              <Text style={styles.headerSubtitle}>{receipts.length} digital receipts</Text>
            </View>
            <TouchableOpacity 
              style={styles.scanButton} 
              onPress={handleScanReceipt}
              disabled={scanning}
            >
              <LinearGradient
                colors={scanning ? ['#9ca3af', '#6b7280'] : ['#10b981', '#059669']}
                style={styles.scanButtonGradient}
              >
                <Ionicons 
                  name={scanning ? "hourglass" : "camera"} 
                  size={24} 
                  color="#fff" 
                />
                <Text style={styles.scanButtonText}>
                  {scanning ? 'Scanning...' : 'Scan Receipt'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* Receipts List */}
      {receipts.length > 0 ? (
        <FlatList
          data={receipts}
          renderItem={renderReceipt}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <Animated.View style={[styles.emptyState, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="receipt-outline" size={64} color="#9ca3af" />
          </View>
          <Text style={styles.emptyStateTitle}>No receipts yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Scan your first receipt to start earning NFTs and loyalty points
          </Text>
          <TouchableOpacity 
            style={styles.emptyStateButton}
            onPress={handleScanReceipt}
          >
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              style={styles.emptyStateButtonGradient}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.emptyStateButtonText}>Scan Receipt</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e7ff',
    marginTop: 4,
    fontWeight: '400',
  },
  scanButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  scanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  listContainer: {
    padding: 20,
    paddingTop: 10,
  },
  receiptCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  receiptCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  receiptImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  receiptImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  receiptImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nftBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  receiptInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  receiptDate: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  receiptFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    fontSize: 12,
    color: '#10b981',
    marginLeft: 4,
    fontWeight: '600',
  },
  receiptAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyStateButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
