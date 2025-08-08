public with sharing class CaseHierarchyController {

    /* 🔧  Update if your org uses a custom Case → Opportunity lookup */
    private static final String OPPTY_LOOKUP_FIELD = 'Opportunity__c';

    /* ------------ Data-transfer object sent to LWC ------------ */
    public class CaseHierarchyNode {
        @AuraEnabled public String   id;            // << now String (was Id)
        @AuraEnabled public String   label;
        @AuraEnabled public String   caseNumber;
        @AuraEnabled public String   subject;
        @AuraEnabled public String   status;
        @AuraEnabled public String   priority;
        @AuraEnabled public String   caseType;
        @AuraEnabled public Integer  childCount;
        @AuraEnabled public Datetime createdDate;
        @AuraEnabled public Datetime lastModifiedDate;
        @AuraEnabled public String   ownerName;
        @AuraEnabled public String   origin;

        @AuraEnabled public String   aeAm;
        @AuraEnabled public Id       aeAmId;
        @AuraEnabled public String   workGroup;
        @AuraEnabled public Id       workGroupId;

        @AuraEnabled public List<CaseHierarchyNode> children = new List<CaseHierarchyNode>();
    }

    /* ------------ Entry point ------------ */
    @AuraEnabled(cacheable=true)
    public static CaseHierarchyNode getHierarchy(Id contextRecordId) {

        if (contextRecordId == null) {
            throw new AuraHandledException('contextRecordId is required.');
        }
        String obj = contextRecordId.getSObjectType().getDescribe().getName();

        /* ①  Gather root Case Ids for the page context */
        Set<Id> rootIds = new Set<Id>();

        if (obj == 'Case') {
            rootIds.add(contextRecordId);
        }
        else if (obj == 'Account') {
            for (Case c : [
                SELECT Id FROM Case
                 WHERE AccountId = :contextRecordId
                   AND ParentId  = NULL
            ]) rootIds.add(c.Id);
        }
        else if (obj == 'Opportunity') {
            String q =
                'SELECT Id FROM Case WHERE ' + OPPTY_LOOKUP_FIELD + ' = :contextRecordId AND ParentId = NULL';
            for (Case c : Database.query(q)) rootIds.add(c.Id);
        }

        /* ②  Handle "no cases" gracefully */
        if (rootIds.isEmpty()) {
            CaseHierarchyNode none  = new CaseHierarchyNode();
            none.id    = 'no-cases';
            none.label = 'No Cases';
            return none;
        }

        /* ③  Recursively pull ALL children in the hierarchy */
        Set<Id> allIds = new Set<Id>(rootIds);
        Set<Id> currentLevel = new Set<Id>(rootIds);
        
        while (!currentLevel.isEmpty()) {
            Set<Id> nextLevel = new Set<Id>();
            for (Case kid : [SELECT Id FROM Case WHERE ParentId IN :currentLevel]) {
                if (!allIds.contains(kid.Id)) {
                    allIds.add(kid.Id);
                    nextLevel.add(kid.Id);
                }
            }
            currentLevel = nextLevel;
        }

        /* ④  Query all required fields */
        Map<Id, Case> cMap = new Map<Id, Case>([
            SELECT  Id, CaseNumber, Subject, Status, Priority, Type, ParentId,
                    CreatedDate, LastModifiedDate, Owner.Name, Origin,
                    AE_AM__c,       AE_AM__r.Name,
                    Work_Group__c,  Work_Group__r.Name
              FROM  Case
             WHERE  Id IN :allIds
        ]);

        /* ⑤  Convert to nodes and stitch hierarchy */
        Map<String, CaseHierarchyNode> nodes = new Map<String, CaseHierarchyNode>();
        for (Case c : cMap.values()) nodes.put((String)c.Id, toNode(c));

        for (Case c : cMap.values()) {
            if (c.ParentId != null && nodes.containsKey((String)c.ParentId)) {
                nodes.get((String)c.ParentId).children.add(nodes.get((String)c.Id));
            }
        }

        /* ⑥  Virtual root when multiple top-level cases */
        if (rootIds.size() > 1 || obj != 'Case') {
            CaseHierarchyNode vr = new CaseHierarchyNode();
            vr.id    = 'virtual-root';
            vr.label = (obj == 'Account')     ? 'Account Cases' :
                       (obj == 'Opportunity') ? 'Opportunity Cases' : 'Cases';
            vr.children   = new List<CaseHierarchyNode>();
            for (Id rid : rootIds) vr.children.add(nodes.get((String)rid));
            vr.childCount = vr.children.size();
            return vr;
        }

        /* ⑦  Single root */
        CaseHierarchyNode root = nodes.get((String)rootIds.iterator().next());
        root.childCount        = root.children.size();
        return root;
    }

    /* ------------ Helper ------------ */
    private static CaseHierarchyNode toNode(Case c) {
        CaseHierarchyNode n = new CaseHierarchyNode();
        n.id               = String.valueOf(c.Id);   // store as String
        n.caseNumber       = c.CaseNumber;
        n.subject          = c.Subject;
        n.status           = c.Status;
        n.priority         = c.Priority;
        n.caseType         = c.Type;
        n.createdDate      = c.CreatedDate;
        n.lastModifiedDate = c.LastModifiedDate;
        n.ownerName        = (c.Owner != null) ? c.Owner.Name : null;
        n.origin           = c.Origin;

        n.aeAm             = (c.AE_AM__r != null)      ? c.AE_AM__r.Name      : null;
        n.aeAmId           = c.AE_AM__c;
        n.workGroup        = (c.Work_Group__r != null) ? c.Work_Group__r.Name : null;
        n.workGroupId      = c.Work_Group__c;
        return n;
    }
}
