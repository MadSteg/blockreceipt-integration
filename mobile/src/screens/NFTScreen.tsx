import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface NFT {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  marketplace: string;
  contractAddress: string;
  tokenId: string;
  receiptId: string;
  merchantName: string;
  purchaseDate: string;
}

export default function NFTScreen({ navigation }: any) {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    loadNFTs();
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

  const loadNFTs = async () => {
    try {
      // Mock NFT data - in production this would come from your backend
      const mockNFTs: NFT[] = [
        {
          id: '1',
          name: 'Digital Art #1234',
          imageUrl: 'https://via.placeholder.com/300x300/6366f1/ffffff?text=NFT+1',
          price: 0.05,
          marketplace: 'OpenSea',
          contractAddress: '0x123...',
          tokenId: '1234',
          receiptId: 'receipt_1',
          merchantName: 'Starbucks',
          purchaseDate: '2024-01-15',
        },
        {
          id: '2',
          name: 'Crypto Collectible #5678',
          imageUrl: 'https://via.placeholder.com/300x300/8b5cf6/ffffff?text=NFT+2',
          price: 0.08,
          marketplace: 'OpenSea',
          contractAddress: '0x456...',
          tokenId: '5678',
          receiptId: 'receipt_2',
          merchantName: 'McDonald\'s',
          purchaseDate: '2024-01-14',
        },
        {
          id: '3',
          name: 'Digital Receipt NFT #9999',
          imageUrl: 'https://via.placeholder.com/300x300/10b981/ffffff?text=NFT+3',
          price: 0.03,
          marketplace: 'OpenSea',
          contractAddress: '0x789...',
          tokenId: '9999',
          receiptId: 'receipt_3',
          merchantName: 'Target',
          purchaseDate: '2024-01-13',
        },
      ];
      
      setNfts(mockNFTs);
    } catch (error) {
      console.error('Error loading NFTs:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderNFT = ({ item, index }: { item: NFT; index: number }) => (
    <Animated.View
      style={[
        styles.nftCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      <TouchableOpacity style={styles.nftCardContent}>
        <View style={styles.nftImageContainer}>
          <Image source={{ uri: item.imageUrl }} style={styles.nftImage} />
          <View style={styles.nftBadge}>
            <Ionicons name="diamond" size={12} color="#fff" />
          </View>
        </View>
        
        <View style={styles.nftInfo}>
          <Text style={styles.nftName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.nftMerchant}>{item.merchantName}</Text>
          <View style={styles.nftFooter}>
            <View style={styles.priceContainer}>
              <Text style={styles.nftPrice}>${item.price.toFixed(2)}</Text>
              <Text style={styles.nftMarketplace}>{item.marketplace}</Text>
            </View>
            <View style={styles.dateContainer}>
              <Text style={styles.nftDate}>{new Date(item.purchaseDate).toLocaleDateString()}</Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity style={styles.nftActionButton}>
          <Ionicons name="eye" size={20} color="#6366f1" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingContent, { opacity: fadeAnim }]}>
          <Ionicons name="diamond" size={60} color="#6366f1" />
          <Text style={styles.loadingText}>Loading your NFTs...</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6', '#a855f7']}
        style={styles.header}
      >
        <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Your NFTs</Text>
              <Text style={styles.headerSubtitle}>{nfts.length} digital collectibles</Text>
            </View>
            <TouchableOpacity style={styles.filterButton}>
              <Ionicons name="filter" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{nfts.length}</Text>
              <Text style={styles.statLabel}>Total NFTs</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>${nfts.reduce((sum, nft) => sum + nft.price, 0).toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total Value</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{new Set(nfts.map(nft => nft.marketplace)).size}</Text>
              <Text style={styles.statLabel}>Marketplaces</Text>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* NFTs Grid */}
      {nfts.length > 0 ? (
        <FlatList
          data={nfts}
          renderItem={renderNFT}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.row}
        />
      ) : (
        <Animated.View style={[styles.emptyState, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="diamond-outline" size={64} color="#9ca3af" />
          </View>
          <Text style={styles.emptyStateTitle}>No NFTs yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Scan receipts to start earning NFTs automatically
          </Text>
          <TouchableOpacity 
            style={styles.emptyStateButton}
            onPress={() => navigation.navigate('Receipts')}
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
    marginBottom: 20,
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
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#e0e7ff',
    textAlign: 'center',
  },
  listContainer: {
    padding: 20,
    paddingTop: 10,
  },
  row: {
    justifyContent: 'space-between',
  },
  nftCard: {
    width: (width - 60) / 2,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  nftCardContent: {
    padding: 12,
  },
  nftImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  nftImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  nftBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  nftInfo: {
    flex: 1,
  },
  nftName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  nftMerchant: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  nftFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flex: 1,
  },
  nftPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 2,
  },
  nftMarketplace: {
    fontSize: 10,
    color: '#6b7280',
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  nftDate: {
    fontSize: 10,
    color: '#9ca3af',
  },
  nftActionButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
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
