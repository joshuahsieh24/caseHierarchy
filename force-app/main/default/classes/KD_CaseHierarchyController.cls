public with sharing class KD_CaseHierarchyController {
    @AuraEnabled(cacheable=true)
    public static CaseWrapper getHierarchy(Id contextRecordId) {
        // ---------- resolve root case Ids based on context ----------
        Schema.SObjectType sObj = contextRecordId.getSObjectType();
        Set<Id> rootIds = new Set<Id>();

        if (sObj == Account.SObjectType) {
            for (Case c : [SELECT Id FROM Case WHERE AccountId = :contextRecordId])
                rootIds.add(c.Id);
        } else if (sObj == Opportunity.SObjectType) {
            for (Case c : [SELECT Id FROM Case WHERE Opportunity__c = :contextRecordId])
                rootIds.add(c.Id);
        } else if (sObj == Case.SObjectType) {
            rootIds.add(contextRecordId);
        }

        if (rootIds.isEmpty()) {
            return new CaseWrapper(
                'no-cases', 'No Cases',
                'No cases found for this record', 'N/A', 'N/A', 'N/A',
                null, null, null, null, null, null, null, null, null, null
            );
        }

        // ---------- breadth-first search to gather ALL descendants ----------
        Set<Id> allIds   = new Set<Id>(rootIds);
        Set<Id> frontier = new Set<Id>(rootIds);
        Integer hops     = 0;           // governor-limit safety-valve

        while (!frontier.isEmpty() && hops < 10) {
            List<Case> kids = [SELECT Id FROM Case WHERE ParentId IN :frontier];
            frontier = new Set<Id>();
            for (Case c : kids) {
                if (allIds.add(c.Id)) frontier.add(c.Id);
            }
            hops++;
        }

        // ---------- bulk-fetch records ----------
        Map<Id, CaseWrapper> wrapById   = new Map<Id, CaseWrapper>();
        Map<Id, Id> parentByChild       = new Map<Id, Id>();

        for (Case c : [
            SELECT Id, CaseNumber, Subject, Status, Priority, Type, ParentId,
                   CreatedDate, LastModifiedDate, Owner.Name, Account.Name,
                   Contact.Name, Origin, Description, IsEscalated, IsClosed, ClosedDate
            FROM Case WHERE Id IN :allIds
        ]) {
            wrapById.put(
                c.Id,
                new CaseWrapper(
                    c.Id,            c.CaseNumber,      c.Subject,       c.Status,
                    c.Priority,      c.Type,            c.CreatedDate,   c.LastModifiedDate,
                    c.Owner?.Name,   c.Account?.Name,   c.Contact?.Name,
                    c.Origin,        c.Description,     c.IsEscalated,   c.IsClosed,
                    c.ClosedDate
                )
            );
            parentByChild.put(c.Id, c.ParentId);
        }

        // ---------- stitch parent-child links ----------
        for (Id childId : parentByChild.keySet()) {
            Id parentId = parentByChild.get(childId);
            if (parentId != null && wrapById.containsKey(parentId)) {
                wrapById.get(parentId).children.add(wrapById.get(childId));
            }
        }

        // quick child-count for UI
        for (CaseWrapper w : wrapById.values()) {
            w.childCount = w.children.size();
        }

        // the component expects a single root wrapper
        return wrapById.get(rootIds.iterator().next());
    }

    // ---------- case wrapper ----------
    public class CaseWrapper {
        @AuraEnabled public Id      id;
        @AuraEnabled public String  caseNumber;
        @AuraEnabled public String  subject;
        @AuraEnabled public String  status;
        @AuraEnabled public String  priority;
        @AuraEnabled public String  caseType;

        @AuraEnabled public DateTime createdDate;
        @AuraEnabled public DateTime lastModifiedDate;

        @AuraEnabled public String ownerName;
        @AuraEnabled public String accountName;
        @AuraEnabled public String contactName;

        @AuraEnabled public String origin;
        @AuraEnabled public String description;
        @AuraEnabled public Boolean isEscalated;
        @AuraEnabled public Boolean isClosed;
        @AuraEnabled public DateTime closedDate;

        @AuraEnabled public Integer childCount = 0;
        @AuraEnabled public List<CaseWrapper> children = new List<CaseWrapper>();

        public CaseWrapper(Id id, String caseNumber, String subject, String status,
                           String priority, String caseType, DateTime createdDate,
                           DateTime lastModifiedDate, String ownerName, String accountName,
                           String contactName, String origin, String description,
                           Boolean isEscalated, Boolean isClosed, DateTime closedDate) {
            this.id = id;
            this.caseNumber = caseNumber;
            this.subject = subject;
            this.status = status;
            this.priority = priority;
            this.caseType = caseType;
            this.createdDate = createdDate;
            this.lastModifiedDate = lastModifiedDate;
            this.ownerName = ownerName;
            this.accountName = accountName;
            this.contactName = contactName;
            this.origin = origin;
            this.description = description;
            this.isEscalated = isEscalated;
            this.isClosed = isClosed;
            this.closedDate = closedDate;
        }
    }
}
