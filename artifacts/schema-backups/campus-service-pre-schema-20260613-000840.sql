-- MySQL dump 10.13  Distrib 8.4.9, for Linux (x86_64)
--
-- Host: localhost    Database: swapcampus
-- ------------------------------------------------------
-- Server version	8.4.9

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `CampusServiceTask`
--

DROP TABLE IF EXISTS `CampusServiceTask`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CampusServiceTask` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('ERRAND','AGENCY','GROUP_BUY','HELP') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reward` decimal(10,2) NOT NULL,
  `locationFrom` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `locationTo` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deadlineLabel` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estimatedMinutes` int NOT NULL,
  `publisherId` int NOT NULL,
  `accepterId` int DEFAULT NULL,
  `status` enum('OPEN','MATCHED','DONE','CANCELED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `cancelReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `canceledAt` datetime(3) DEFAULT NULL,
  `canceledById` int DEFAULT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  `contactPreference` enum('CHAT_ONLY','PHONE_AFTER_MATCH','FLEXIBLE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CHAT_ONLY',
  `fulfillmentMode` enum('DROP_OFF','FACE_TO_FACE','FLEXIBLE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FLEXIBLE',
  `itemCount` int NOT NULL DEFAULT '1',
  `matchedAt` datetime(3) DEFAULT NULL,
  `trustNote` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `urgency` enum('NORMAL','TODAY','URGENT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NORMAL',
  PRIMARY KEY (`id`),
  KEY `CampusServiceTask_publisherId_status_createdAt_idx` (`publisherId`,`status`,`createdAt`),
  KEY `CampusServiceTask_accepterId_status_updatedAt_idx` (`accepterId`,`status`,`updatedAt`),
  KEY `CampusServiceTask_category_status_createdAt_idx` (`category`,`status`,`createdAt`),
  CONSTRAINT `CampusServiceTask_accepterId_fkey` FOREIGN KEY (`accepterId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CampusServiceTask_publisherId_fkey` FOREIGN KEY (`publisherId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CampusServiceTask`
--

LOCK TABLES `CampusServiceTask` WRITE;
/*!40000 ALTER TABLE `CampusServiceTask` DISABLE KEYS */;
INSERT INTO `CampusServiceTask` VALUES (10,'帮取快递到宿舍楼下','ERRAND','下午 5 点后可帮取菜鸟驿站快递，送到学 12 楼下，要求及时联系。',6.00,'菜鸟驿站','学12公寓楼下','今天 18:30 前',25,46,NULL,'OPEN','2026-06-09 07:53:29.004','2026-06-09 07:53:29.004',NULL,NULL,NULL,NULL,'CHAT_ONLY','DROP_OFF',1,NULL,'请提供取件码，送达后当面确认。','TODAY');
/*!40000 ALTER TABLE `CampusServiceTask` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Conversation`
--

DROP TABLE IF EXISTS `Conversation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Conversation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `orderId` int DEFAULT NULL,
  `productId` int DEFAULT NULL,
  `campusServiceTaskId` int DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `campusServiceOrderId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Conversation_orderId_updatedAt_idx` (`orderId`,`updatedAt`),
  KEY `Conversation_productId_updatedAt_idx` (`productId`,`updatedAt`),
  KEY `Conversation_campusServiceTaskId_updatedAt_idx` (`campusServiceTaskId`,`updatedAt`),
  KEY `Conversation_campusServiceOrderId_updatedAt_idx` (`campusServiceOrderId`,`updatedAt`),
  CONSTRAINT `Conversation_campusServiceOrderId_fkey` FOREIGN KEY (`campusServiceOrderId`) REFERENCES `CampusServiceOrder` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Conversation_campusServiceTaskId_fkey` FOREIGN KEY (`campusServiceTaskId`) REFERENCES `CampusServiceTask` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Conversation_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Conversation_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Conversation`
--

LOCK TABLES `Conversation` WRITE;
/*!40000 ALTER TABLE `Conversation` DISABLE KEYS */;
/*!40000 ALTER TABLE `Conversation` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-12 16:08:40
